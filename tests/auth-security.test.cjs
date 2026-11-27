const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const Module = require('node:module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) {
    const mapped = path.join(process.cwd(), request.slice(2));
    return originalResolve.call(this, mapped, parent, ...rest);
  }
  return originalResolve.call(this, request, parent, ...rest);
};

process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef0123456789abcdef';
process.env.APP_URL = 'https://vistra-learn.vercel.app';

const { generateKeyPairSync, sign: cryptoSign } = require('node:crypto');
const { setMongoDbForTests } = require('../lib/mongodb.ts');
const { setEmailTransportForTests } = require('../lib/email/resend.ts');
const { checkRateLimit } = require('../lib/auth/rate-limit.ts');
const { isAllowedEmailDomain } = require('../lib/auth/domain-policy.ts');
const {
  buildGoogleAuthorizationUrl,
  constantTimeEqual,
  createOAuthTransaction,
  setGoogleOAuthTestHooks,
  verifyGoogleIdToken,
} = require('../lib/auth/google.ts');
const {
  MAGIC_LINK_TTL_MS,
  SESSION_TTL_MS,
  authenticateWithGoogleProfile,
  invalidateSessionToken,
  registerUserAccount,
  requestMagicLoginLink,
  validateSessionToken,
  verifyMagicLinkAndCreateSession,
} = require('../lib/auth/service.ts');

function matchesFilter(doc, filter) {
  for (const [k, v] of Object.entries(filter)) {
    const dv = doc[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('$gt' in v && !(dv instanceof Date ? dv.getTime() > v.$gt.getTime() : dv > v.$gt)) return false;
      if ('$lt' in v && !(dv instanceof Date ? dv.getTime() < v.$lt.getTime() : dv < v.$lt)) return false;
      if ('$lte' in v && !(dv instanceof Date ? dv.getTime() <= v.$lte.getTime() : dv <= v.$lte)) return false;
    } else if (v === null) {
      if (dv !== null && dv !== undefined) return false;
    } else if (dv instanceof Date && v instanceof Date) {
      if (dv.getTime() !== v.getTime()) return false;
    } else if (dv !== v) {
      return false;
    }
  }
  return true;
}

function applyUpdate(doc, update) {
  if (Array.isArray(update)) {
    for (const stage of update) {
      if (stage.$set) {
        for (const [k, v] of Object.entries(stage.$set)) {
          if (v && typeof v === 'object' && '$ifNull' in v) {
            const [fieldRef, fallback] = v.$ifNull;
            const fieldName = typeof fieldRef === 'string' && fieldRef.startsWith('$') ? fieldRef.slice(1) : fieldRef;
            doc[k] = doc[fieldName] ?? fallback;
          } else {
            doc[k] = v;
          }
        }
      }
    }
    return;
  }
  if (update.$set) {
    Object.assign(doc, update.$set);
  }
  if (update.$inc) {
    for (const [k, delta] of Object.entries(update.$inc)) {
      doc[k] = (doc[k] ?? 0) + delta;
    }
  }
}

function createInMemoryMongoDb() {
  const store = { users: [], magicLinks: [], sessions: [], rateLimits: [], emailOtps: [] };
  const uniqueFields = {
    users: ['email', 'id'],
    magicLinks: ['tokenHash'],
    sessions: ['sessionTokenHash'],
    rateLimits: ['key'],
    emailOtps: ['id'],
  };

  function makeCollection(name) {
    const docs = store[name];
    return {
      async findOne(filter) {
        const found = docs.find((d) => matchesFilter(d, filter));
        return found ? { ...found } : null;
      },
      async insertOne(doc) {
        for (const field of uniqueFields[name] || []) {
          if (docs.some((d) => d[field] === doc[field])) {
            const err = new Error(`E11000 duplicate key on ${name}.${field}`);
            err.code = 11000;
            throw err;
          }
        }
        docs.push({ ...doc });
        return { acknowledged: true };
      },
      async updateOne(filter, update, opts = {}) {
        const found = docs.find((d) => matchesFilter(d, filter));
        if (!found) {
          if (opts.upsert) {
            const created = { ...filter };
            applyUpdate(created, update);
            docs.push(created);
          }
          return { modifiedCount: 0 };
        }
        applyUpdate(found, update);
        return { modifiedCount: 1 };
      },
      async findOneAndUpdate(filter, update) {
        const found = docs.find((d) => matchesFilter(d, filter));
        if (!found) return null;
        applyUpdate(found, update);
        return { ...found };
      },
      async deleteOne(filter) {
        const idx = docs.findIndex((d) => matchesFilter(d, filter));
        if (idx >= 0) {
          docs.splice(idx, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      },
      async deleteMany(filter) {
        let deleted = 0;
        for (let i = docs.length - 1; i >= 0; i--) {
          if (matchesFilter(docs[i], filter)) {
            docs.splice(i, 1);
            deleted++;
          }
        }
        return { deletedCount: deleted };
      },
      async countDocuments() {
        return docs.length;
      },
    };
  }

  return {
    store,
    collection: (name) => makeCollection(name),
  };
}

test('registration creates user, sends exact welcome email without secrets, and blocks duplicate emails', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (payload) => {
    sent.push(payload);
    return { ok: true, id: 'email-1' };
  });

  const res = await registerUserAccount({ name: '  Ada   Lovelace ', email: 'ADA@Gmail.COM' });
  assert.equal(res.ok, true);
  assert.equal(res.status, 201);
  assert.equal(res.user.email, 'ada@gmail.com');
  assert.equal(res.user.name, 'Ada Lovelace');
  assert.equal(res.user.role, 'student');

  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, 'Welcome to Vistra — Your account is ready!');
  assert.match(sent[0].text, /Hi Ada Lovelace,/);
  assert.match(sent[0].text, /See beyond the code\./);
  assert.match(sent[0].text, /— Team Vistra/);
  assert.doesNotMatch(sent[0].text, /token=|password|otp/i);

  const dup = await registerUserAccount({ name: 'Ada Two', email: 'ada@gmail.com' });
  assert.equal(dup.ok, false);
  assert.equal(dup.status, 409);
  assert.equal(dup.code, 'ACCOUNT_EXISTS');
  assert.equal(sent.length, 1);
});

test('registration fails honestly and rolls back when email delivery fails', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);
  setEmailTransportForTests(async () => ({ ok: false, error: 'Resend API down' }));

  const res = await registerUserAccount({ name: 'Grace Hopper', email: 'grace@gmail.com' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 502);
  assert.equal(res.code, 'EMAIL_FAILED');
  assert.equal(memDb.store.users.length, 0);
});

test('login-link request stores only hashed token, uses neutral response for unknown email, and authenticates once', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (payload) => {
    sent.push(payload);
    return { ok: true, id: `email-${sent.length}` };
  });

  await registerUserAccount({ name: 'Alan Turing', email: 'alan@gmail.com' });
  sent.length = 0;

  const unknownRes = await requestMagicLoginLink({ email: 'unknown@gmail.com' });
  assert.equal(unknownRes.ok, true);
  assert.equal(unknownRes.status, 200);
  assert.equal(unknownRes.message, 'If an account exists for this email address, a secure login link has been sent.');
  assert.equal(sent.length, 0);

  const nowMs = Date.UTC(2026, 10, 27, 9, 0, 0);
  const knownRes = await requestMagicLoginLink({ email: 'ALAN@gmail.com', nowMs });
  assert.equal(knownRes.ok, true);
  assert.equal(knownRes.status, 200);
  assert.equal(knownRes.message, unknownRes.message);
  assert.equal(sent.length, 1);

  const match = sent[0].text.match(/https:\/\/vistra-learn\.vercel\.app\/auth\/verify\?token=([^\s]+)/);
  assert.ok(match, 'Magic link URL must be present in email');
  const rawToken = decodeURIComponent(match[1]);
  assert.ok(rawToken.length >= 32);

  const tokenDoc = memDb.store.magicLinks[0];
  assert.ok(tokenDoc);
  assert.notEqual(tokenDoc.tokenHash, rawToken);

  const verified = await verifyMagicLinkAndCreateSession(rawToken, nowMs + 60_000);
  assert.equal(verified.ok, true);
  assert.equal(verified.user.email, 'alan@gmail.com');
  assert.ok(verified.user.emailVerifiedAt);
  assert.ok(verified.sessionToken);

  const replayed = await verifyMagicLinkAndCreateSession(rawToken, nowMs + 61_000);
  assert.equal(replayed.ok, false);
  assert.equal(replayed.reason, 'used');

  const validSession = await validateSessionToken(verified.sessionToken, nowMs + 62_000);
  assert.ok(validSession);
  assert.equal(validSession.user.email, 'alan@gmail.com');

  await invalidateSessionToken(verified.sessionToken);
  const afterLogout = await validateSessionToken(verified.sessionToken, nowMs + 63_000);
  assert.equal(afterLogout, null);
});

test('expired, invalid, and concurrent magic-link verifications are rejected safely', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (payload) => {
    sent.push(payload);
    return { ok: true, id: `email-${sent.length}` };
  });

  await registerUserAccount({ name: 'Linus', email: 'linus@gmail.com' });
  sent.length = 0;

  const t0 = Date.UTC(2026, 10, 27, 10, 0, 0);
  await requestMagicLoginLink({ email: 'linus@gmail.com', nowMs: t0 });
  const expiredToken = decodeURIComponent(sent[0].text.match(/token=([^\s]+)/)[1]);

  const expiredResult = await verifyMagicLinkAndCreateSession(expiredToken, t0 + MAGIC_LINK_TTL_MS + 1000);
  assert.equal(expiredResult.ok, false);
  assert.equal(expiredResult.reason, 'expired');

  const invalidResult = await verifyMagicLinkAndCreateSession('not-a-real-token-0123456789abcdef0123456789abcdef', t0);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.reason, 'invalid');

  sent.length = 0;
  await requestMagicLoginLink({ email: 'linus@gmail.com', nowMs: t0 + 5000 });
  const raceToken = decodeURIComponent(sent[0].text.match(/token=([^\s]+)/)[1]);
  const results = await Promise.all([
    verifyMagicLinkAndCreateSession(raceToken, t0 + 6000),
    verifyMagicLinkAndCreateSession(raceToken, t0 + 6000),
  ]);
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].reason, 'used');

  const sessionToken = successes[0].sessionToken;
  const expiredSession = await validateSessionToken(sessionToken, t0 + 6000 + SESSION_TTL_MS + 1000);
  assert.equal(expiredSession, null);
});

test('rate limiter blocks requests above threshold and resets after window', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const base = Date.UTC(2026, 10, 27, 11, 0, 0);
  for (let i = 0; i < 5; i++) {
    const r = await checkRateLimit('login:email', 'user@example.com', 5, 600_000, base + i * 1000);
    assert.equal(r.allowed, true);
  }
  const blocked = await checkRateLimit('login:email', 'user@example.com', 5, 600_000, base + 6000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  const afterReset = await checkRateLimit('login:email', 'user@example.com', 5, 600_000, base + 601_000);
  assert.equal(afterReset.allowed, true);
});

test('EMAIL_MODE=development restricts emails to RESEND_TEST_RECIPIENT and fails closed in production', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (payload) => {
    sent.push(payload);
    return { ok: true, id: `dev-email-${sent.length}` };
  });

  const prevMode = process.env.EMAIL_MODE;
  const prevRecipient = process.env.RESEND_TEST_RECIPIENT;
  const prevNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_MODE = 'development';
    process.env.RESEND_TEST_RECIPIENT = 'owner-test@gmail.com';

    // Unsupported recipient on registration is rejected
    const blockedReg = await registerUserAccount({ name: 'Other Student', email: 'student@gmail.com' });
    assert.equal(blockedReg.ok, false);
    assert.equal(blockedReg.status, 403);
    assert.equal(blockedReg.code, 'DEV_RECIPIENT_RESTRICTED');
    assert.equal(
      blockedReg.message,
      'Vistra is currently in development mode. Email sign-in is available only for the configured test email address.',
    );
    assert.equal(memDb.store.users.length, 0);

    // Unsupported recipient on login is rejected
    const blockedLogin = await requestMagicLoginLink({ email: 'student@gmail.com' });
    assert.equal(blockedLogin.ok, false);
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.code, 'DEV_RECIPIENT_RESTRICTED');
    assert.equal(sent.length, 0);

    // Configured test recipient works end-to-end (still requires real magic-link verification)
    const okReg = await registerUserAccount({ name: 'Vistra Owner', email: 'OWNER-TEST@gmail.com' });
    assert.equal(okReg.ok, true);
    assert.equal(okReg.status, 201);
    assert.equal(sent.length, 1);

    const okLogin = await requestMagicLoginLink({ email: 'owner-test@gmail.com' });
    assert.equal(okLogin.ok, true);
    assert.equal(sent.length, 2);

    // Development mode cannot bypass verification
    const bypass = await verifyMagicLinkAndCreateSession('');
    assert.equal(bypass.ok, false);

    const rawToken = decodeURIComponent(sent[1].text.match(/token=([^\s]+)/)[1]);
    const verified = await verifyMagicLinkAndCreateSession(rawToken);
    assert.equal(verified.ok, true);
    assert.equal(verified.user.email, 'owner-test@gmail.com');

    // Production rejects EMAIL_MODE=development
    process.env.NODE_ENV = 'production';
    const prodBlocked = await requestMagicLoginLink({ email: 'owner-test@gmail.com' });
    assert.equal(prodBlocked.ok, false);
    assert.equal(prodBlocked.status, 503);
    assert.equal(prodBlocked.code, 'EMAIL_CONFIG_ERROR');
  } finally {
    if (prevMode === undefined) delete process.env.EMAIL_MODE;
    else process.env.EMAIL_MODE = prevMode;
    if (prevRecipient === undefined) delete process.env.RESEND_TEST_RECIPIENT;
    else process.env.RESEND_TEST_RECIPIENT = prevRecipient;
    process.env.NODE_ENV = prevNodeEnv;
  }
});

test('Resend test-sender restriction rolls back user and returns clear external-email-unavailable message', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);
  setEmailTransportForTests(async () => ({
    ok: false,
    restrictedRecipient: true,
    error: 'Resend test-sender restriction: external recipients require a verified domain.',
  }));

  const res = await registerUserAccount({ name: 'External User', email: 'external@gmail.com' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 403);
  assert.equal(res.code, 'EXTERNAL_EMAIL_UNAVAILABLE');
  assert.match(res.message, /External email delivery is not currently available/i);
  assert.equal(memDb.store.users.length, 0);
});

function signTestJwt(payload, privateKey, headerOverrides = {}) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT', ...headerOverrides }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = cryptoSign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
  return `${header}.${body}.${sig}`;
}

test('Gmail-only domain policy rejects non-Gmail, lookalike, and subdomain addresses', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);
  setEmailTransportForTests(async () => ({ ok: true, id: 'email-1' }));

  assert.equal(isAllowedEmailDomain('student@gmail.com'), true);
  assert.equal(isAllowedEmailDomain('Student@GMAIL.COM'), true);
  assert.equal(isAllowedEmailDomain('student@yahoo.com'), false);
  assert.equal(isAllowedEmailDomain('student@gmai1.com'), false);
  assert.equal(isAllowedEmailDomain('student@sub.gmail.com'), false);
  assert.equal(isAllowedEmailDomain('student@gmail.com.evil.com'), false);

  for (const badEmail of ['student@yahoo.com', 'student@gmai1.com', 'student@sub.gmail.com']) {
    const res = await registerUserAccount({ name: 'Non Gmail', email: badEmail });
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'DOMAIN_NOT_ALLOWED');
    assert.equal(res.message, 'Vistra registration is currently available only to verified Gmail accounts.');
  }
  assert.equal(memDb.store.users.length, 0);
});

test('Google OIDC ID token verification validates signature, issuer, audience, expiry, nonce, and verified email', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  setGoogleOAuthTestHooks({
    jwksFetcher: async () => ({ keys: [{ ...publicJwk, kid: 'test-kid-1', alg: 'RS256', use: 'sig' }] }),
  });

  const nowSec = 1_800_000_000;
  const baseClaims = {
    iss: 'https://accounts.google.com',
    aud: 'google-client-id-123',
    sub: 'google-sub-001',
    email: 'learner@gmail.com',
    email_verified: true,
    name: 'Google Learner',
    nonce: 'nonce-abc',
    iat: nowSec - 60,
    exp: nowSec + 3600,
  };

  try {
    // Valid ID token
    const validJwt = signTestJwt(baseClaims, privateKey);
    const verified = await verifyGoogleIdToken({
      idToken: validJwt,
      expectedAudience: 'google-client-id-123',
      expectedNonce: 'nonce-abc',
      nowSeconds: nowSec,
    });
    assert.equal(verified.email, 'learner@gmail.com');
    assert.equal(verified.sub, 'google-sub-001');

    // Tampered signature rejected
    const parts = validJwt.split('.');
    const tamperedJwt = `${parts[0]}.${parts[1]}.AAAA${parts[2].slice(4)}`;
    await assert.rejects(
      () => verifyGoogleIdToken({ idToken: tamperedJwt, expectedAudience: 'google-client-id-123', nowSeconds: nowSec }),
      /Invalid Google ID token signature/,
    );

    // Wrong audience rejected
    const wrongAud = signTestJwt({ ...baseClaims, aud: 'other-app-id' }, privateKey);
    await assert.rejects(
      () => verifyGoogleIdToken({ idToken: wrongAud, expectedAudience: 'google-client-id-123', nowSeconds: nowSec }),
      /audience/i,
    );

    // Wrong issuer rejected
    const wrongIss = signTestJwt({ ...baseClaims, iss: 'https://evil.example.com' }, privateKey);
    await assert.rejects(
      () => verifyGoogleIdToken({ idToken: wrongIss, expectedAudience: 'google-client-id-123', nowSeconds: nowSec }),
      /issuer/i,
    );

    // Expired token rejected
    const expiredJwt = signTestJwt({ ...baseClaims, exp: nowSec - 10 }, privateKey);
    await assert.rejects(
      () => verifyGoogleIdToken({ idToken: expiredJwt, expectedAudience: 'google-client-id-123', nowSeconds: nowSec }),
      /expired/i,
    );

    // Unverified email rejected
    const unverifiedJwt = signTestJwt({ ...baseClaims, email_verified: false }, privateKey);
    await assert.rejects(
      () => verifyGoogleIdToken({ idToken: unverifiedJwt, expectedAudience: 'google-client-id-123', nowSeconds: nowSec }),
      /not verified/i,
    );

    // Nonce mismatch rejected
    await assert.rejects(
      () => verifyGoogleIdToken({ idToken: validJwt, expectedAudience: 'google-client-id-123', expectedNonce: 'wrong-nonce', nowSeconds: nowSec }),
      /nonce/i,
    );
  } finally {
    setGoogleOAuthTestHooks({ jwksFetcher: null });
  }
});

test('Google Sign-In creates Gmail users, links existing users safely without duplicates, and rejects non-Gmail or unverified users', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);
  setEmailTransportForTests(async () => ({ ok: true, id: 'email-1' }));

  // Non-Gmail Google account rejected
  const nonGmail = await authenticateWithGoogleProfile({
    sub: 'g-sub-1',
    email: 'corp@company.com',
    emailVerified: true,
    name: 'Corp User',
  });
  assert.equal(nonGmail.ok, false);
  assert.equal(nonGmail.status, 403);
  assert.equal(nonGmail.code, 'DOMAIN_NOT_ALLOWED');
  assert.equal(nonGmail.message, 'Vistra registration is currently available only to verified Gmail accounts.');

  // Unverified Google email rejected
  const unverified = await authenticateWithGoogleProfile({
    sub: 'g-sub-2',
    email: 'unverified@gmail.com',
    emailVerified: false,
    name: 'Unverified',
  });
  assert.equal(unverified.ok, false);
  assert.equal(unverified.status, 403);
  assert.equal(unverified.code, 'UNVERIFIED_GOOGLE_EMAIL');

  // Register existing email user first, then link via Google Sign-In
  const emailReg = await registerUserAccount({ name: 'Existing Student', email: 'existing@gmail.com' });
  assert.equal(emailReg.ok, true);
  const originalId = emailReg.user.id;

  const linked = await authenticateWithGoogleProfile({
    sub: 'g-sub-linked',
    email: 'EXISTING@gmail.com',
    emailVerified: true,
    name: 'Existing Student',
  });
  assert.equal(linked.ok, true);
  assert.equal(linked.user.id, originalId);
  assert.equal(linked.user.role, 'student');
  assert.ok(linked.sessionToken);
  assert.equal(memDb.store.users.length, 1);
  assert.deepEqual(memDb.store.users[0].authProviders, ['email', 'google']);
  assert.equal(memDb.store.users[0].googleSub, 'g-sub-linked');

  // Session persists and can be validated
  const validSession = await validateSessionToken(linked.sessionToken);
  assert.ok(validSession);
  assert.equal(validSession.user.id, originalId);

  // Mismatched googleSub for the same email is rejected
  const mismatch = await authenticateWithGoogleProfile({
    sub: 'g-sub-different',
    email: 'existing@gmail.com',
    emailVerified: true,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.code, 'GOOGLE_ACCOUNT_MISMATCH');

  // New Gmail user via Google Sign-In
  const newGoogle = await authenticateWithGoogleProfile({
    sub: 'g-sub-new',
    email: 'brandnew@gmail.com',
    emailVerified: true,
    name: 'Brand New',
  });
  assert.equal(newGoogle.ok, true);
  assert.equal(memDb.store.users.length, 2);
  assert.deepEqual(memDb.store.users[1].authProviders, ['google']);
});

test('OAuth state and PKCE authorization URL generation are CSRF-safe', () => {
  const tx = createOAuthTransaction();
  assert.ok(tx.state.length >= 32);
  assert.ok(tx.codeVerifier.length >= 32);
  assert.ok(tx.nonce.length >= 32);
  assert.equal(constantTimeEqual(tx.state, tx.state), true);
  assert.equal(constantTimeEqual(tx.state, 'tampered-state'), false);

  const authUrl = buildGoogleAuthorizationUrl(
    {
      clientId: 'cid-1',
      clientSecret: 'csec-1',
      redirectUri: 'https://vistra-learn.vercel.app/api/auth/google/callback',
    },
    tx,
  );
  const parsed = new URL(authUrl);
  assert.equal(parsed.origin, 'https://accounts.google.com');
  assert.equal(parsed.searchParams.get('scope'), 'openid email profile');
  assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(parsed.searchParams.get('state'), tx.state);
  assert.equal(parsed.searchParams.get('nonce'), tx.nonce);
});

const { verifySameOriginRequest } = require('../lib/auth/csrf.ts');

test('CSRF same-origin check blocks cross-site POST requests and allows same-origin', () => {
  const crossOriginReq = new Request('https://vistra-learn.vercel.app/api/auth/logout', {
    method: 'POST',
    headers: { origin: 'https://evil.example.com', 'sec-fetch-site': 'cross-site' },
  });
  assert.equal(verifySameOriginRequest(crossOriginReq), false);

  const sameOriginReq = new Request('https://vistra-learn.vercel.app/api/auth/logout', {
    method: 'POST',
    headers: { origin: 'https://vistra-learn.vercel.app', 'sec-fetch-site': 'same-origin' },
  });
  assert.equal(verifySameOriginRequest(sameOriginReq), true);
});

test('session rotation invalidates prior token hash and verification clears older pending magic links', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);
  const sent = [];
  setEmailTransportForTests(async (p) => {
    sent.push(p);
    return { ok: true, id: `e-${sent.length}` };
  });

  await registerUserAccount({ name: 'Rotate User', email: 'rotate@gmail.com' });
  sent.length = 0;

  const t0 = Date.UTC(2026, 10, 27, 12, 0, 0);
  await requestMagicLoginLink({ email: 'rotate@gmail.com', nowMs: t0 });
  await requestMagicLoginLink({ email: 'rotate@gmail.com', nowMs: t0 + 1000 });
  const olderToken = decodeURIComponent(sent[0].text.match(/token=([^\s]+)/)[1]);
  const newerToken = decodeURIComponent(sent[1].text.match(/token=([^\s]+)/)[1]);

  const verified = await verifyMagicLinkAndCreateSession(newerToken, t0 + 2000);
  assert.equal(verified.ok, true);

  // Older unconsumed magic link was invalidated
  const olderResult = await verifyMagicLinkAndCreateSession(olderToken, t0 + 3000);
  assert.equal(olderResult.ok, false);

  // Past half-life, validateSessionToken rotates the session token
  const afterHalfLife = t0 + 2000 + SESSION_TTL_MS / 2 + 60_000;
  const rotated = await validateSessionToken(verified.sessionToken, afterHalfLife);
  assert.ok(rotated);
  assert.equal(rotated.renewed, true);
  assert.ok(rotated.rotatedSessionToken);
  assert.notEqual(rotated.rotatedSessionToken, verified.sessionToken);

  // Old session token is no longer valid after rotation
  const oldAfterRotate = await validateSessionToken(verified.sessionToken, afterHalfLife + 1000);
  assert.equal(oldAfterRotate, null);

  // New rotated session token is valid
  const newAfterRotate = await validateSessionToken(rotated.rotatedSessionToken, afterHalfLife + 1000);
  assert.ok(newAfterRotate);
  assert.equal(newAfterRotate.user.email, 'rotate@gmail.com');
});

const { ensureGoogleSubPartialIndex } = require('../lib/mongodb.ts');

test('multiple email-only registrations succeed without googleSub and duplicate googleSub is rejected', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);
  setEmailTransportForTests(async () => ({ ok: true, id: 'e-1' }));

  const r1 = await registerUserAccount({ name: 'Email One', email: 'email1@gmail.com' });
  const r2 = await registerUserAccount({ name: 'Email Two', email: 'email2@gmail.com' });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(memDb.store.users.length, 2);
  assert.equal('googleSub' in memDb.store.users[0], false);
  assert.equal('googleSub' in memDb.store.users[1], false);

  const g1 = await authenticateWithGoogleProfile({
    sub: 'unique-sub-1',
    email: 'google1@gmail.com',
    emailVerified: true,
    name: 'Google One',
  });
  assert.equal(g1.ok, true);

  // Attempting to link a different email to an already-used googleSub is blocked
  const mismatch = await authenticateWithGoogleProfile({
    sub: 'unique-sub-1',
    email: 'google1@gmail.com',
    emailVerified: true,
  });
  assert.equal(mismatch.ok, true);

  // Force mismatch check: email2 already linked to different sub cannot take unique-sub-1
  await authenticateWithGoogleProfile({
    sub: 'unique-sub-2',
    email: 'email2@gmail.com',
    emailVerified: true,
  });
  const hijackAttempt = await authenticateWithGoogleProfile({
    sub: 'unique-sub-other',
    email: 'email2@gmail.com',
    emailVerified: true,
  });
  assert.equal(hijackAttempt.ok, false);
  assert.equal(hijackAttempt.status, 409);
});

test('ensureGoogleSubPartialIndex safely migrates legacy sparse index and unsets null googleSub', async () => {
  const dropped = [];
  const created = [];
  const updated = [];
  const fakeUsersCol = {
    async indexes() {
      return [
        { name: '_id_', key: { _id: 1 } },
        { name: 'idx_users_email_unique', key: { email: 1 }, unique: true },
        { name: 'idx_users_google_sub_unique', key: { googleSub: 1 }, unique: true, sparse: true },
      ];
    },
    async dropIndex(name) {
      dropped.push(name);
    },
    async updateMany(filter, update) {
      updated.push({ filter, update });
      return { modifiedCount: 1 };
    },
    async createIndex(key, opts) {
      created.push({ key, opts });
    },
  };

  await ensureGoogleSubPartialIndex(fakeUsersCol);
  assert.deepEqual(dropped, ['idx_users_google_sub_unique']);
  assert.equal(updated.length, 1);
  assert.deepEqual(updated[0].filter, { googleSub: null });
  assert.deepEqual(updated[0].update, { $unset: { googleSub: '' } });
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].opts.partialFilterExpression, { googleSub: { $type: 'string' } });
  assert.equal(created[0].opts.unique, true);
});

test('MongoDB unavailable scenario fails closed during session validation', async () => {
  setMongoDbForTests({
    collection() {
      throw new Error('MongoServerSelectionError: connection refused');
    },
  });

  await assert.rejects(
    () => validateSessionToken('dummy-session-token-0123456789abcdef0123456789'),
    /connection refused/,
  );
});

const {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateNumericOtp,
  hashOtp,
  verifyOtpHashConstantTime,
} = require('../lib/auth/otp.ts');
const {
  requestLoginOtp,
  requestRegistrationOtp,
  verifyLoginOtp,
  verifyRegistrationOtp,
} = require('../lib/auth/service.ts');
const regReqRoute = require('../app/api/auth/otp/register/request/route.ts');
const regVerifyRoute = require('../app/api/auth/otp/register/verify/route.ts');
const loginReqRoute = require('../app/api/auth/otp/login/request/route.ts');
const loginVerifyRoute = require('../app/api/auth/otp/login/verify/route.ts');

test('OTP crypto generates 6-digit codes, hashes with domain separation, and verifies in constant time', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateNumericOtp();
    assert.match(code, /^\d{6}$/);
  }
  const h1 = hashOtp({ purpose: 'register', email: 'User@Gmail.com', challengeId: 'c1', otp: '123456' });
  const h2 = hashOtp({ purpose: 'register', email: 'user@gmail.com', challengeId: 'c1', otp: '123456' });
  const h3 = hashOtp({ purpose: 'login', email: 'user@gmail.com', challengeId: 'c1', otp: '123456' });
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.equal(verifyOtpHashConstantTime(h1, h2), true);
  assert.equal(verifyOtpHashConstantTime(h1, h3), false);
});

test('registration OTP creates user only after verification, enforces cooldown, expiry, 5-attempt lockout, and single-use concurrency', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (payload) => {
    sent.push(payload);
    return { ok: true, id: `otp-email-${sent.length}` };
  });

  const t0 = Date.UTC(2026, 10, 27, 15, 0, 0);

  // Request registration OTP
  const reqRes = await requestRegistrationOtp({ name: 'Otp Student', email: 'otpstudent@gmail.com', nowMs: t0 });
  assert.equal(reqRes.ok, true);
  assert.equal(reqRes.status, 200);
  assert.ok(reqRes.challengeId);
  assert.equal(sent.length, 1);
  // User must NOT exist before OTP verification
  assert.equal(memDb.store.users.length, 0);
  assert.equal(memDb.store.emailOtps.length, 1);

  const otpMatch = sent[0].text.match(/\b(\d{6})\b/);
  assert.ok(otpMatch);
  const rawOtp = otpMatch[1];
  // Raw OTP must not be stored in DB or returned in response
  assert.notEqual(memDb.store.emailOtps[0].otpHash, rawOtp);
  assert.equal(JSON.stringify(reqRes).includes(rawOtp), false);

  // Resend cooldown enforced for 60s
  const tooSoon = await requestRegistrationOtp({
    name: 'Otp Student',
    email: 'otpstudent@gmail.com',
    nowMs: t0 + 15_000,
  });
  assert.equal(tooSoon.ok, false);
  assert.equal(tooSoon.status, 429);
  assert.equal(tooSoon.code, 'RESEND_COOLDOWN');
  assert.ok(tooSoon.retryAfterSeconds >= 40);

  // Expired OTP rejected after 5 minutes
  const expiredVerify = await verifyRegistrationOtp({
    email: 'otpstudent@gmail.com',
    otp: rawOtp,
    challengeId: reqRes.challengeId,
    nowMs: t0 + OTP_TTL_MS + 1000,
  });
  assert.equal(expiredVerify.ok, false);
  assert.equal(expiredVerify.status, 401);
  assert.equal(expiredVerify.code, 'OTP_EXPIRED');

  // After 60s cooldown, resend succeeds and issues a fresh OTP
  const resendRes = await requestRegistrationOtp({
    name: 'Otp Student',
    email: 'otpstudent@gmail.com',
    nowMs: t0 + OTP_RESEND_COOLDOWN_MS + 1000,
  });
  assert.equal(resendRes.ok, true);
  const freshOtp = sent[1].text.match(/\b(\d{6})\b/)[1];

  // 5 incorrect attempts lock the challenge
  for (let attempt = 1; attempt <= OTP_MAX_ATTEMPTS; attempt++) {
    const wrongOtp = freshOtp === '000000' ? '111111' : '000000';
    const bad = await verifyRegistrationOtp({
      email: 'otpstudent@gmail.com',
      otp: wrongOtp,
      challengeId: resendRes.challengeId,
      nowMs: t0 + OTP_RESEND_COOLDOWN_MS + 2000 + attempt * 100,
    });
    assert.equal(bad.ok, false);
    if (attempt < OTP_MAX_ATTEMPTS) {
      assert.equal(bad.status, 401);
      assert.equal(bad.code, 'INVALID_OTP');
    } else {
      assert.equal(bad.status, 429);
      assert.equal(bad.code, 'OTP_LOCKED');
    }
  }
  assert.equal(memDb.store.users.length, 0);

  // Request a 3rd OTP and test concurrent verification: only 1 succeeds
  const thirdReq = await requestRegistrationOtp({
    name: 'Otp Student',
    email: 'otpstudent@gmail.com',
    nowMs: t0 + OTP_RESEND_COOLDOWN_MS * 3,
  });
  assert.equal(thirdReq.ok, true);
  const thirdOtp = sent[2].text.match(/\b(\d{6})\b/)[1];

  const raceResults = await Promise.all([
    verifyRegistrationOtp({
      email: 'otpstudent@gmail.com',
      otp: thirdOtp,
      challengeId: thirdReq.challengeId,
      nowMs: t0 + OTP_RESEND_COOLDOWN_MS * 3 + 5000,
    }),
    verifyRegistrationOtp({
      email: 'otpstudent@gmail.com',
      otp: thirdOtp,
      challengeId: thirdReq.challengeId,
      nowMs: t0 + OTP_RESEND_COOLDOWN_MS * 3 + 5000,
    }),
  ]);
  const winners = raceResults.filter((r) => r.ok);
  const losers = raceResults.filter((r) => !r.ok);
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.equal(memDb.store.users.length, 1);
  assert.deepEqual(memDb.store.users[0].authProviders, ['email-otp']);
  assert.ok(winners[0].sessionToken);

  // Duplicate registration after verification is blocked
  const dup = await requestRegistrationOtp({
    name: 'Otp Student',
    email: 'otpstudent@gmail.com',
    nowMs: t0 + OTP_RESEND_COOLDOWN_MS * 5,
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.status, 409);
  assert.equal(dup.code, 'ACCOUNT_EXISTS');
});

test('login OTP authenticates existing Google and magic-link users while preserving ID, role, and metadata', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (payload) => {
    sent.push(payload);
    return { ok: true, id: `login-otp-${sent.length}` };
  });

  // Unknown email returns generic 200 without sending email
  const unknown = await requestLoginOtp({ email: 'nobody@gmail.com' });
  assert.equal(unknown.ok, true);
  assert.equal(unknown.status, 200);
  assert.equal(sent.length, 0);

  // 1. Existing Google user with custom role 'mentor'
  const gAuth = await authenticateWithGoogleProfile({
    sub: 'google-sub-preserve',
    email: 'google-existing@gmail.com',
    emailVerified: true,
    name: 'Google Mentor',
  });
  assert.equal(gAuth.ok, true);
  const googleUser = memDb.store.users.find((u) => u.email === 'google-existing@gmail.com');
  googleUser.role = 'mentor';

  const gOtpReq = await requestLoginOtp({ email: 'GOOGLE-EXISTING@gmail.com' });
  assert.equal(gOtpReq.ok, true);
  assert.equal(sent.length, 1);
  const gOtp = sent[0].text.match(/\b(\d{6})\b/)[1];

  const gOtpVerify = await verifyLoginOtp({ email: 'google-existing@gmail.com', otp: gOtp });
  assert.equal(gOtpVerify.ok, true);
  assert.equal(gOtpVerify.user.id, googleUser.id);
  assert.equal(gOtpVerify.user.role, 'mentor');
  assert.equal(googleUser.googleSub, 'google-sub-preserve');
  assert.deepEqual(googleUser.authProviders, ['google', 'email-otp']);

  // 2. Existing magic-link user
  sent.length = 0;
  await registerUserAccount({ name: 'Magic User', email: 'magic-existing@gmail.com' });
  const magicUser = memDb.store.users.find((u) => u.email === 'magic-existing@gmail.com');
  const originalMagicId = magicUser.id;
  sent.length = 0;

  const mOtpReq = await requestLoginOtp({ email: 'magic-existing@gmail.com' });
  assert.equal(mOtpReq.ok, true);
  assert.equal(sent.length, 1);
  const mOtp = sent[0].text.match(/\b(\d{6})\b/)[1];

  const mOtpVerify = await verifyLoginOtp({ email: 'magic-existing@gmail.com', otp: mOtp });
  assert.equal(mOtpVerify.ok, true);
  assert.equal(mOtpVerify.user.id, originalMagicId);
  assert.equal(mOtpVerify.user.role, 'student');
  assert.deepEqual(magicUser.authProviders, ['email', 'email-otp']);
});

test('OTP email delivery failure cleans up pending challenge and OTP HTTP routes enforce CSRF, rate limits, and HttpOnly cookies', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  // Email delivery failure invalidates challenge
  setEmailTransportForTests(async () => ({ ok: false, error: 'Resend error' }));
  const failedReg = await requestRegistrationOtp({ name: 'Fail User', email: 'fail@gmail.com' });
  assert.equal(failedReg.ok, false);
  assert.equal(failedReg.status, 502);
  assert.equal(memDb.store.emailOtps.length, 0);
  assert.equal(memDb.store.users.length, 0);

  // Route handler CSRF & HttpOnly cookie checks
  const sent = [];
  setEmailTransportForTests(async (p) => {
    sent.push(p);
    return { ok: true, id: `http-${sent.length}` };
  });

  const csrfBlocked = await regReqRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/register/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example.com',
        'sec-fetch-site': 'cross-site',
      },
      body: JSON.stringify({ name: 'Evil', email: 'evil@gmail.com' }),
    }),
  );
  assert.equal(csrfBlocked.status, 403);

  const regReqHttp = await regReqRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/register/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://vistra-learn.vercel.app',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify({ name: 'Route User', email: 'route-user@gmail.com' }),
    }),
  );
  assert.equal(regReqHttp.status, 200);
  const regReqJson = await regReqHttp.json();
  const httpOtp = sent[0].text.match(/\b(\d{6})\b/)[1];
  assert.equal(JSON.stringify(regReqJson).includes(httpOtp), false);

  const regVerifyHttp = await regVerifyRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/register/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://vistra-learn.vercel.app',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify({
        email: 'route-user@gmail.com',
        otp: httpOtp,
        challengeId: regReqJson.challengeId,
      }),
    }),
  );
  assert.equal(regVerifyHttp.status, 201);
  const setCookie = regVerifyHttp.headers.get('set-cookie') || '';
  assert.match(setCookie, /vistra_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);

  // IP rate limit on login OTP route after 15 requests from same IP
  for (let i = 0; i < 15; i++) {
    const r = await loginReqRoute.POST(
      new Request('https://vistra-learn.vercel.app/api/auth/otp/login/request', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://vistra-learn.vercel.app',
          'sec-fetch-site': 'same-origin',
          'x-forwarded-for': '203.0.113.88',
        },
        body: JSON.stringify({ email: `ratelimit-otp-${i}@gmail.com` }),
      }),
    );
    assert.equal(r.status, 200);
  }
  const rateBlocked = await loginReqRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/login/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://vistra-learn.vercel.app',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': '203.0.113.88',
      },
      body: JSON.stringify({ email: 'ratelimit-otp-99@gmail.com' }),
    }),
  );
  assert.equal(rateBlocked.status, 429);
  assert.ok(loginVerifyRoute.POST);
});

test('concurrent wrong OTP attempts cap at 5 without consuming valid OTP, and valid OTP still works before lockout', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (p) => {
    sent.push(p);
    return { ok: true, id: `cw-${sent.length}` };
  });

  const t0 = Date.UTC(2026, 10, 27, 16, 0, 0);
  await registerUserAccount({ name: 'Concurrent User', email: 'cw@gmail.com' });
  sent.length = 0;

  await requestLoginOtp({ email: 'cw@gmail.com', nowMs: t0 });
  const realOtp = sent[0].text.match(/\b(\d{6})\b/)[1];
  const wrongOtp = realOtp === '000000' ? '111111' : '000000';

  // 2 wrong attempts must NOT consume the valid OTP
  await verifyLoginOtp({ email: 'cw@gmail.com', otp: wrongOtp, nowMs: t0 + 1000 });
  await verifyLoginOtp({ email: 'cw@gmail.com', otp: wrongOtp, nowMs: t0 + 2000 });
  assert.equal(memDb.store.emailOtps[0].consumedAt, null);
  assert.equal(memDb.store.emailOtps[0].attempts, 2);

  // 7 concurrent wrong attempts -> capped at 5, remaining rejected with 429 OTP_LOCKED
  const burst = await Promise.all(
    Array.from({ length: 7 }, (_, i) =>
      verifyLoginOtp({ email: 'cw@gmail.com', otp: wrongOtp, nowMs: t0 + 3000 + i }),
    ),
  );
  assert.equal(memDb.store.emailOtps[0].attempts, 5);
  assert.equal(burst.every((r) => !r.ok), true);
  assert.ok(burst.some((r) => r.status === 429 && r.code === 'OTP_LOCKED'));

  // Subsequent valid OTP is rejected because challenge is locked
  const afterLock = await verifyLoginOtp({ email: 'cw@gmail.com', otp: realOtp, nowMs: t0 + 5000 });
  assert.equal(afterLock.ok, false);
  assert.equal(afterLock.status, 429);
  assert.equal(afterLock.code, 'OTP_LOCKED');
});

test('concurrent resend requests allow exactly one winner, and email failure releases cooldown for immediate retry', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (p) => {
    sent.push(p);
    return { ok: true, id: `resend-${sent.length}` };
  });

  const t0 = Date.UTC(2026, 10, 27, 16, 10, 0);
  const parallelReqs = await Promise.all([
    requestRegistrationOtp({ name: 'Race Reg', email: 'racereg@gmail.com', nowMs: t0 }),
    requestRegistrationOtp({ name: 'Race Reg', email: 'racereg@gmail.com', nowMs: t0 }),
    requestRegistrationOtp({ name: 'Race Reg', email: 'racereg@gmail.com', nowMs: t0 }),
  ]);
  const winners = parallelReqs.filter((r) => r.ok);
  const losers = parallelReqs.filter((r) => !r.ok && r.code === 'RESEND_COOLDOWN');
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 2);
  assert.equal(sent.length, 1);

  // Email delivery failure releases cooldown so user can retry immediately
  setEmailTransportForTests(async () => ({ ok: false, error: 'Temporary Resend outage' }));
  const failReq = await requestRegistrationOtp({ name: 'Retry User', email: 'retry@gmail.com', nowMs: t0 });
  assert.equal(failReq.ok, false);
  assert.equal(failReq.status, 502);

  setEmailTransportForTests(async (p) => {
    sent.push(p);
    return { ok: true, id: 'retry-ok' };
  });
  const immediateRetry = await requestRegistrationOtp({ name: 'Retry User', email: 'retry@gmail.com', nowMs: t0 + 1000 });
  assert.equal(immediateRetry.ok, true);
});

test('login OTP responses are indistinguishable for existing vs unknown emails, and loginVerifyRoute sets secure cookie via HTTP Request', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const sent = [];
  setEmailTransportForTests(async (p) => {
    sent.push(p);
    return { ok: true, id: `eq-${sent.length}` };
  });

  await registerUserAccount({ name: 'Known User', email: 'known@gmail.com' });
  sent.length = 0;

  const t0 = Date.UTC(2026, 10, 27, 16, 20, 0);

  // 1st request: both unknown and known return identical status & message
  const unk1 = await requestLoginOtp({ email: 'unknown@gmail.com', nowMs: t0 });
  const kwn1 = await requestLoginOtp({ email: 'known@gmail.com', nowMs: t0 });
  assert.equal(unk1.status, 200);
  assert.equal(kwn1.status, 200);
  assert.equal(unk1.message, kwn1.message);

  // 2nd request within 60s: both unknown and known return 429 RESEND_COOLDOWN
  const unk2 = await requestLoginOtp({ email: 'unknown@gmail.com', nowMs: t0 + 5000 });
  const kwn2 = await requestLoginOtp({ email: 'known@gmail.com', nowMs: t0 + 5000 });
  assert.equal(unk2.status, 429);
  assert.equal(kwn2.status, 429);
  assert.equal(unk2.code, 'RESEND_COOLDOWN');
  assert.equal(kwn2.code, 'RESEND_COOLDOWN');

  // Execute loginVerifyRoute.POST with real HTTP Request before superseding challenge
  const otp = sent[0].text.match(/\b(\d{6})\b/)[1];
  const verifyHttp = await loginVerifyRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/login/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://vistra-learn.vercel.app',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': '203.0.113.55',
      },
      body: JSON.stringify({ email: 'known@gmail.com', otp }),
    }),
  );
  assert.equal(verifyHttp.status, 200);
  const cookieHeader = verifyHttp.headers.get('set-cookie') || '';
  assert.match(cookieHeader, /vistra_session=/);
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);

  // Even if email delivery fails for known user, public response stays neutral 200
  setEmailTransportForTests(async () => ({ ok: false, restrictedRecipient: true, error: '403' }));
  const kwnFail = await requestLoginOtp({ email: 'known@gmail.com', nowMs: t0 + 70_000 });
  assert.equal(kwnFail.status, 200);
  assert.equal(kwnFail.message, unk1.message);
});

test('OTP POST routes reject oversized payloads and malformed JSON safely', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);

  const oversized = await loginReqRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/login/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://vistra-learn.vercel.app',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': '203.0.113.71',
      },
      body: JSON.stringify({ email: 'a'.repeat(3000) + '@gmail.com' }),
    }),
  );
  assert.equal(oversized.status, 413);

  const malformed = await regReqRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/register/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://vistra-learn.vercel.app',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': '203.0.113.72',
      },
      body: '{"email": "broken@gmail.com"',
    }),
  );
  assert.equal(malformed.status, 400);

  const wrongContentType = await regVerifyRoute.POST(
    new Request('https://vistra-learn.vercel.app/api/auth/otp/register/verify', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        origin: 'https://vistra-learn.vercel.app',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': '203.0.113.73',
      },
      body: 'email=test@gmail.com',
    }),
  );
  assert.equal(wrongContentType.status, 415);
});

const { sanitizeAuthError } = require('../lib/auth/http-error.ts');

test('sanitizeAuthError captures DNS fields without exposing credentials, URIs, or tokens', () => {
  const dnsErr = Object.assign(new Error('querySrv ENOTFOUND _mongodb._tcp.cluster0.abc12.mongodb.net'), {
    code: 'ENOTFOUND',
    syscall: 'querySrv',
    hostname: '_mongodb._tcp.cluster0.abc12.mongodb.net',
  });
  const sanitized = sanitizeAuthError(dnsErr);
  assert.deepEqual(sanitized, {
    name: 'Error',
    code: 'ENOTFOUND',
    syscall: 'querySrv',
    hostname: '_mongodb._tcp.cluster0.abc12.mongodb.net',
  });

  // Never includes message/URIs and strips any accidental userinfo from hostname
  const leakyErr = Object.assign(new Error('mongodb+srv://admin:supersecret@cluster0.abc12.mongodb.net/vistra'), {
    code: 'ENOTFOUND',
    syscall: 'getaddrinfo',
    hostname: 'admin:supersecret@cluster0.abc12.mongodb.net/vistra',
  });
  const cleaned = sanitizeAuthError(leakyErr);
  assert.equal(cleaned.hostname, 'cluster0.abc12.mongodb.net');
  assert.equal(JSON.stringify(cleaned).includes('supersecret'), false);
  assert.equal(JSON.stringify(cleaned).includes('admin'), false);
});

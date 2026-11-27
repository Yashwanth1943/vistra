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

const { setMongoDbForTests } = require('../lib/mongodb.ts');
const { setEmailTransportForTests } = require('../lib/email/resend.ts');
const { checkRateLimit } = require('../lib/auth/rate-limit.ts');
const {
  MAGIC_LINK_TTL_MS,
  SESSION_TTL_MS,
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
  const store = { users: [], magicLinks: [], sessions: [], rateLimits: [] };
  const uniqueFields = {
    users: ['email', 'id'],
    magicLinks: ['tokenHash'],
    sessions: ['sessionTokenHash'],
    rateLimits: ['key'],
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

  const res = await registerUserAccount({ name: '  Ada   Lovelace ', email: 'ADA@Example.COM' });
  assert.equal(res.ok, true);
  assert.equal(res.status, 201);
  assert.equal(res.user.email, 'ada@example.com');
  assert.equal(res.user.name, 'Ada Lovelace');
  assert.equal(res.user.role, 'student');

  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, 'Welcome to Vistra — Your account is ready!');
  assert.match(sent[0].text, /Hi Ada Lovelace,/);
  assert.match(sent[0].text, /See beyond the code\./);
  assert.match(sent[0].text, /— Team Vistra/);
  assert.doesNotMatch(sent[0].text, /token=|password|otp/i);

  const dup = await registerUserAccount({ name: 'Ada Two', email: 'ada@example.com' });
  assert.equal(dup.ok, false);
  assert.equal(dup.status, 409);
  assert.equal(dup.code, 'ACCOUNT_EXISTS');
  assert.equal(sent.length, 1);
});

test('registration fails honestly and rolls back when email delivery fails', async () => {
  const memDb = createInMemoryMongoDb();
  setMongoDbForTests(memDb);
  setEmailTransportForTests(async () => ({ ok: false, error: 'Resend API down' }));

  const res = await registerUserAccount({ name: 'Grace Hopper', email: 'grace@example.com' });
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

  await registerUserAccount({ name: 'Alan Turing', email: 'alan@example.com' });
  sent.length = 0;

  const unknownRes = await requestMagicLoginLink({ email: 'unknown@example.com' });
  assert.equal(unknownRes.ok, true);
  assert.equal(unknownRes.status, 200);
  assert.equal(unknownRes.message, 'If an account exists for this email address, a secure login link has been sent.');
  assert.equal(sent.length, 0);

  const nowMs = Date.UTC(2026, 10, 27, 9, 0, 0);
  const knownRes = await requestMagicLoginLink({ email: 'ALAN@example.com', nowMs });
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
  assert.equal(verified.user.email, 'alan@example.com');
  assert.ok(verified.user.emailVerifiedAt);
  assert.ok(verified.sessionToken);

  const replayed = await verifyMagicLinkAndCreateSession(rawToken, nowMs + 61_000);
  assert.equal(replayed.ok, false);
  assert.equal(replayed.reason, 'used');

  const validSession = await validateSessionToken(verified.sessionToken, nowMs + 62_000);
  assert.ok(validSession);
  assert.equal(validSession.user.email, 'alan@example.com');

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

  await registerUserAccount({ name: 'Linus', email: 'linus@example.com' });
  sent.length = 0;

  const t0 = Date.UTC(2026, 10, 27, 10, 0, 0);
  await requestMagicLoginLink({ email: 'linus@example.com', nowMs: t0 });
  const expiredToken = decodeURIComponent(sent[0].text.match(/token=([^\s]+)/)[1]);

  const expiredResult = await verifyMagicLinkAndCreateSession(expiredToken, t0 + MAGIC_LINK_TTL_MS + 1000);
  assert.equal(expiredResult.ok, false);
  assert.equal(expiredResult.reason, 'expired');

  const invalidResult = await verifyMagicLinkAndCreateSession('not-a-real-token-0123456789abcdef0123456789abcdef', t0);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.reason, 'invalid');

  sent.length = 0;
  await requestMagicLoginLink({ email: 'linus@example.com', nowMs: t0 + 5000 });
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
    process.env.RESEND_TEST_RECIPIENT = 'owner-test@example.com';

    // Unsupported recipient on registration is rejected
    const blockedReg = await registerUserAccount({ name: 'Other Student', email: 'student@example.com' });
    assert.equal(blockedReg.ok, false);
    assert.equal(blockedReg.status, 403);
    assert.equal(blockedReg.code, 'DEV_RECIPIENT_RESTRICTED');
    assert.equal(
      blockedReg.message,
      'Vistra is currently in development mode. Email sign-in is available only for the configured test email address.',
    );
    assert.equal(memDb.store.users.length, 0);

    // Unsupported recipient on login is rejected
    const blockedLogin = await requestMagicLoginLink({ email: 'student@example.com' });
    assert.equal(blockedLogin.ok, false);
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.code, 'DEV_RECIPIENT_RESTRICTED');
    assert.equal(sent.length, 0);

    // Configured test recipient works end-to-end (still requires real magic-link verification)
    const okReg = await registerUserAccount({ name: 'Vistra Owner', email: 'OWNER-TEST@example.com' });
    assert.equal(okReg.ok, true);
    assert.equal(okReg.status, 201);
    assert.equal(sent.length, 1);

    const okLogin = await requestMagicLoginLink({ email: 'owner-test@example.com' });
    assert.equal(okLogin.ok, true);
    assert.equal(sent.length, 2);

    // Development mode cannot bypass verification
    const bypass = await verifyMagicLinkAndCreateSession('');
    assert.equal(bypass.ok, false);

    const rawToken = decodeURIComponent(sent[1].text.match(/token=([^\s]+)/)[1]);
    const verified = await verifyMagicLinkAndCreateSession(rawToken);
    assert.equal(verified.ok, true);
    assert.equal(verified.user.email, 'owner-test@example.com');

    // Production rejects EMAIL_MODE=development
    process.env.NODE_ENV = 'production';
    const prodBlocked = await requestMagicLoginLink({ email: 'owner-test@example.com' });
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

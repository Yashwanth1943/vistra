import { getCollections, type EmailOtpDocument, type UserDocument } from '../mongodb';
import { sendEmail } from '../email/resend';
import { buildMagicLinkEmail, buildOtpEmail, buildWelcomeEmail } from '../email/templates';
import {
  generateId,
  generateSecureToken,
  hashToken,
  isValidEmail,
  isValidName,
  normalizeEmail,
  normalizeName,
} from './crypto';
import { ALLOWED_DOMAIN_ERROR_MESSAGE, isAllowedEmailDomain } from './domain-policy';
import {
  generateNumericOtp,
  generateOtpChallengeId,
  hashOtp,
  isValidOtpFormat,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  verifyOtpHashConstantTime,
} from './otp';
import { claimOtpCooldown, releaseOtpCooldown } from './rate-limit';

export const MAGIC_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_RENEWAL_THRESHOLD_MS = SESSION_TTL_MS / 2;
export const SESSION_COOKIE_NAME = 'vistra_session';
export const DEFAULT_USER_ROLE = 'student';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export const DEV_MODE_RESTRICTED_MESSAGE =
  'Vistra is currently in development mode. Email sign-in is available only for the configured test email address.';

export type EmailModeConfig =
  | { ok: true; mode: 'production' }
  | { ok: true; mode: 'development'; testRecipient: string }
  | { ok: false; error: string };

export function getEmailModeConfig(): EmailModeConfig {
  const rawMode = process.env.EMAIL_MODE?.trim().toLowerCase();
  if (rawMode === 'development') {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        error: 'Development email mode is disabled in production.',
      };
    }
    const testRecipient = normalizeEmail(process.env.RESEND_TEST_RECIPIENT ?? '');
    if (!isValidEmail(testRecipient)) {
      return {
        ok: false,
        error: 'RESEND_TEST_RECIPIENT must be configured with a valid email address in development email mode.',
      };
    }
    return { ok: true, mode: 'development', testRecipient };
  }
  return { ok: true, mode: 'production' };
}

export interface RegisterResult {
  ok: boolean;
  status: number;
  code?: 'INVALID_INPUT' | 'DOMAIN_NOT_ALLOWED' | 'ACCOUNT_EXISTS' | 'EMAIL_FAILED' | 'EXTERNAL_EMAIL_UNAVAILABLE' | 'DEV_RECIPIENT_RESTRICTED' | 'EMAIL_CONFIG_ERROR';
  message: string;
  user?: Pick<AuthUser, 'id' | 'name' | 'email' | 'role'>;
}

export interface GoogleAuthResult {
  ok: boolean;
  status: number;
  code?: 'UNVERIFIED_GOOGLE_EMAIL' | 'DOMAIN_NOT_ALLOWED' | 'GOOGLE_ACCOUNT_MISMATCH' | 'INVALID_INPUT';
  message?: string;
  user?: AuthUser;
  sessionToken?: string;
  sessionExpiresAt?: Date;
}

export interface RequestLoginLinkResult {
  ok: boolean;
  status: number;
  code?: 'INVALID_EMAIL' | 'EMAIL_FAILED' | 'EXTERNAL_EMAIL_UNAVAILABLE' | 'DEV_RECIPIENT_RESTRICTED' | 'EMAIL_CONFIG_ERROR';
  message: string;
}

export interface VerifyMagicLinkResult {
  ok: boolean;
  reason?: 'missing' | 'invalid' | 'expired' | 'used';
  user?: AuthUser;
  sessionToken?: string;
  sessionExpiresAt?: Date;
}

export interface ValidatedSession {
  sessionId: string;
  user: AuthUser;
  expiresAt: string;
  renewed: boolean;
  newExpiresAt?: Date;
  rotatedSessionToken?: string;
}

function mapUser(doc: UserDocument): AuthUser {
  return {
    id: doc.id,
    name: doc.name,
    email: doc.email,
    emailVerifiedAt: doc.emailVerifiedAt ? doc.emailVerifiedAt.toISOString() : null,
    role: doc.role,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export function getAppUrl(fallbackOrigin?: string): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (fallbackOrigin) {
    return fallbackOrigin.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export async function registerUserAccount(input: {
  name: string;
  email: string;
}): Promise<RegisterResult> {
  const cleanName = normalizeName(input.name ?? '');
  const cleanEmail = normalizeEmail(input.email ?? '');

  if (!isValidName(cleanName)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Please enter your full name (between 2 and 80 characters).',
    };
  }

  if (!isValidEmail(cleanEmail)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Please enter a valid email address.',
    };
  }

  if (!isAllowedEmailDomain(cleanEmail)) {
    return {
      ok: false,
      status: 403,
      code: 'DOMAIN_NOT_ALLOWED',
      message: ALLOWED_DOMAIN_ERROR_MESSAGE,
    };
  }

  const emailConfig = getEmailModeConfig();
  if (!emailConfig.ok) {
    return {
      ok: false,
      status: 503,
      code: 'EMAIL_CONFIG_ERROR',
      message: emailConfig.error,
    };
  }
  if (emailConfig.mode === 'development' && cleanEmail !== emailConfig.testRecipient) {
    return {
      ok: false,
      status: 403,
      code: 'DEV_RECIPIENT_RESTRICTED',
      message: DEV_MODE_RESTRICTED_MESSAGE,
    };
  }

  const { users } = await getCollections();
  const existing = await users.findOne({ email: cleanEmail }, { projection: { id: 1 } });

  if (existing) {
    return {
      ok: false,
      status: 409,
      code: 'ACCOUNT_EXISTS',
      message: 'An account with this email address already exists. Please sign in instead.',
    };
  }

  const id = generateId();
  const now = new Date();

  try {
    await users.insertOne({
      id,
      name: cleanName,
      email: cleanEmail,
      emailVerifiedAt: null,
      role: DEFAULT_USER_ROLE,
      authProviders: ['email'],
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return {
        ok: false,
        status: 409,
        code: 'ACCOUNT_EXISTS',
        message: 'An account with this email address already exists. Please sign in instead.',
      };
    }
    throw error;
  }

  const welcome = buildWelcomeEmail({ name: cleanName });
  const emailResult = await sendEmail({
    to: cleanEmail,
    subject: welcome.subject,
    text: welcome.text,
    html: welcome.html,
  });

  if (!emailResult.ok) {
    await users.deleteOne({ id });
    if (emailResult.restrictedRecipient) {
      return {
        ok: false,
        status: 403,
        code: 'EXTERNAL_EMAIL_UNAVAILABLE',
        message:
          'External email delivery is not currently available. Only the authorized test account email can receive registration emails right now.',
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'EMAIL_FAILED',
      message: 'We could not deliver your welcome email right now. Please try again shortly.',
    };
  }

  return {
    ok: true,
    status: 201,
    message:
      'Your Vistra account has been created and a welcome email has been sent. Sign in with your email to receive a magic link.',
    user: {
      id,
      name: cleanName,
      email: cleanEmail,
      role: DEFAULT_USER_ROLE,
    },
  };
}

export async function requestMagicLoginLink(input: {
  email: string;
  origin?: string;
  nowMs?: number;
}): Promise<RequestLoginLinkResult> {
  const cleanEmail = normalizeEmail(input.email ?? '');
  if (!isValidEmail(cleanEmail)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_EMAIL',
      message: 'Please enter a valid email address.',
    };
  }

  const emailConfig = getEmailModeConfig();
  if (!emailConfig.ok) {
    return {
      ok: false,
      status: 503,
      code: 'EMAIL_CONFIG_ERROR',
      message: emailConfig.error,
    };
  }
  if (emailConfig.mode === 'development' && cleanEmail !== emailConfig.testRecipient) {
    return {
      ok: false,
      status: 403,
      code: 'DEV_RECIPIENT_RESTRICTED',
      message: DEV_MODE_RESTRICTED_MESSAGE,
    };
  }

  const neutralMessage =
    'If an account exists for this email address, a secure login link has been sent.';

  const { users, magicLinks } = await getCollections();
  const user = await users.findOne({ email: cleanEmail });

  if (!user) {
    return {
      ok: true,
      status: 200,
      message: neutralMessage,
    };
  }

  const nowMs = input.nowMs ?? Date.now();
  const createdAt = new Date(nowMs);
  const expiresAt = new Date(nowMs + MAGIC_LINK_TTL_MS);
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const tokenId = generateId();

  await magicLinks.deleteMany({ userId: user.id, expiresAt: { $lte: createdAt } });

  await magicLinks.insertOne({
    id: tokenId,
    userId: user.id,
    tokenHash,
    expiresAt,
    consumedAt: null,
    createdAt,
  });

  const appUrl = getAppUrl(input.origin);
  const loginUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(rawToken)}`;
  const emailContent = buildMagicLinkEmail({
    name: user.name,
    loginUrl,
    expiresInMinutes: 10,
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  if (!emailResult.ok) {
    await magicLinks.deleteOne({ id: tokenId });
    if (emailResult.restrictedRecipient) {
      return {
        ok: false,
        status: 403,
        code: 'EXTERNAL_EMAIL_UNAVAILABLE',
        message:
          'External email delivery is not currently available. Only the authorized test account email can receive sign-in links right now.',
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'EMAIL_FAILED',
      message: 'Unable to send your login link right now. Please try again shortly.',
    };
  }

  return {
    ok: true,
    status: 200,
    message: neutralMessage,
  };
}

export async function verifyMagicLinkAndCreateSession(
  rawToken: string,
  nowMs = Date.now(),
): Promise<VerifyMagicLinkResult> {
  const token = (rawToken ?? '').trim();
  if (!token || token.length < 32) {
    return { ok: false, reason: token ? 'invalid' : 'missing' };
  }

  const { users, magicLinks, sessions } = await getCollections();
  const tokenHash = hashToken(token);
  const now = new Date(nowMs);

  // Atomic single-use consumption: only one concurrent caller can win this update.
  const consumed = await magicLinks.findOneAndUpdate(
    {
      tokenHash,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: { consumedAt: now },
    },
    {
      returnDocument: 'after',
    },
  );

  if (!consumed) {
    const existing = await magicLinks.findOne(
      { tokenHash },
      { projection: { consumedAt: 1, expiresAt: 1 } },
    );
    if (!existing) {
      return { ok: false, reason: 'invalid' };
    }
    if (existing.consumedAt) {
      return { ok: false, reason: 'used' };
    }
    return { ok: false, reason: 'expired' };
  }

  // Invalidate any earlier unconsumed magic links for this user and mark email verified.
  await magicLinks.deleteMany({ userId: consumed.userId, consumedAt: null });

  await users.updateOne(
    { id: consumed.userId },
    [
      {
        $set: {
          emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', now] },
          updatedAt: now,
        },
      },
    ],
  );

  const userDoc = await users.findOne({ id: consumed.userId });
  if (!userDoc) {
    return { ok: false, reason: 'invalid' };
  }

  // Always issue a fresh session token & ID to prevent session fixation.
  const rawSessionToken = generateSecureToken();
  const sessionTokenHash = hashToken(rawSessionToken);
  const sessionId = generateId();
  const sessionExpiresAt = new Date(nowMs + SESSION_TTL_MS);

  await sessions.insertOne({
    id: sessionId,
    userId: userDoc.id,
    sessionTokenHash,
    expiresAt: sessionExpiresAt,
    createdAt: now,
  });

  return {
    ok: true,
    user: mapUser(userDoc),
    sessionToken: rawSessionToken,
    sessionExpiresAt,
  };
}

export async function validateSessionToken(
  rawSessionToken: string | undefined,
  nowMs = Date.now(),
): Promise<ValidatedSession | null> {
  if (!rawSessionToken || rawSessionToken.trim().length < 32) {
    return null;
  }

  const { users, sessions } = await getCollections();
  const sessionHash = hashToken(rawSessionToken.trim());
  const now = new Date(nowMs);

  const sessionDoc = await sessions.findOne({
    sessionTokenHash: sessionHash,
    expiresAt: { $gt: now },
  });

  if (!sessionDoc) {
    return null;
  }

  const userDoc = await users.findOne({ id: sessionDoc.userId });
  if (!userDoc) {
    return null;
  }

  const expiresMs = sessionDoc.expiresAt.getTime();
  let renewed = false;
  let newExpiresAt: Date | undefined;
  let rotatedSessionToken: string | undefined;

  if (expiresMs - nowMs < SESSION_RENEWAL_THRESHOLD_MS) {
    newExpiresAt = new Date(nowMs + SESSION_TTL_MS);
    rotatedSessionToken = generateSecureToken();
    const rotatedHash = hashToken(rotatedSessionToken);
    await sessions.updateOne(
      { id: sessionDoc.id },
      { $set: { expiresAt: newExpiresAt, sessionTokenHash: rotatedHash } },
    );
    renewed = true;
  }

  return {
    sessionId: sessionDoc.id,
    user: mapUser(userDoc),
    expiresAt: (newExpiresAt ?? sessionDoc.expiresAt).toISOString(),
    renewed,
    newExpiresAt,
    rotatedSessionToken,
  };
}

export async function invalidateSessionToken(rawSessionToken: string | undefined): Promise<void> {
  if (!rawSessionToken || rawSessionToken.trim().length < 32) {
    return;
  }
  const { sessions } = await getCollections();
  const sessionHash = hashToken(rawSessionToken.trim());
  await sessions.deleteOne({ sessionTokenHash: sessionHash });
}

/**
 * Authenticates or registers a user from verified Google OIDC claims, enforcing verified
 * email ownership, Gmail-only domain policy, and safe account linking.
 */
export async function authenticateWithGoogleProfile(
  input: {
    sub: string;
    email: string;
    emailVerified: boolean;
    name?: string;
    picture?: string;
  },
  nowMs = Date.now(),
): Promise<GoogleAuthResult> {
  if (!input.emailVerified) {
    return {
      ok: false,
      status: 403,
      code: 'UNVERIFIED_GOOGLE_EMAIL',
      message: 'Your Google email address must be verified before signing in to Vistra.',
    };
  }

  const cleanEmail = normalizeEmail(input.email ?? '');
  const cleanSub = (input.sub ?? '').trim();
  if (!cleanSub || !isValidEmail(cleanEmail)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Google account did not return a valid verified identity.',
    };
  }

  if (!isAllowedEmailDomain(cleanEmail)) {
    return {
      ok: false,
      status: 403,
      code: 'DOMAIN_NOT_ALLOWED',
      message: ALLOWED_DOMAIN_ERROR_MESSAGE,
    };
  }

  const { users, sessions } = await getCollections();
  const now = new Date(nowMs);

  let userDoc: UserDocument | null = await users.findOne({ googleSub: cleanSub });
  if (!userDoc) {
    userDoc = await users.findOne({ email: cleanEmail });
  }

  if (userDoc) {
    if (userDoc.googleSub && userDoc.googleSub !== cleanSub) {
      return {
        ok: false,
        status: 409,
        code: 'GOOGLE_ACCOUNT_MISMATCH',
        message: 'This email address is already linked to a different Google account.',
      };
    }

    const existingProviders = Array.isArray(userDoc.authProviders) && userDoc.authProviders.length > 0
      ? userDoc.authProviders
      : ['email'];
    const mergedProviders = existingProviders.includes('google')
      ? existingProviders
      : [...existingProviders, 'google'];

    await users.updateOne(
      { id: userDoc.id },
      {
        $set: {
          googleSub: cleanSub,
          authProviders: mergedProviders,
          emailVerifiedAt: userDoc.emailVerifiedAt ?? now,
          avatarUrl: input.picture ?? userDoc.avatarUrl ?? null,
          updatedAt: now,
        },
      },
    );

    userDoc = (await users.findOne({ id: userDoc.id })) ?? userDoc;
  } else {
    const cleanName = isValidName(input.name ?? '')
      ? normalizeName(input.name ?? '')
      : cleanEmail.split('@')[0];
    const id = generateId();
    const newDoc: UserDocument = {
      id,
      name: cleanName,
      email: cleanEmail,
      emailVerifiedAt: now,
      role: DEFAULT_USER_ROLE,
      authProviders: ['google'],
      googleSub: cleanSub,
      avatarUrl: input.picture ?? null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await users.insertOne(newDoc);
      userDoc = newDoc;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const raced = await users.findOne({ email: cleanEmail });
        if (!raced) throw error;
        userDoc = raced;
      } else {
        throw error;
      }
    }
  }

  // Always issue a fresh session token & ID to prevent session fixation.
  const rawSessionToken = generateSecureToken();
  const sessionTokenHash = hashToken(rawSessionToken);
  const sessionId = generateId();
  const sessionExpiresAt = new Date(nowMs + SESSION_TTL_MS);

  await sessions.insertOne({
    id: sessionId,
    userId: userDoc.id,
    sessionTokenHash,
    expiresAt: sessionExpiresAt,
    createdAt: now,
  });

  return {
    ok: true,
    status: 200,
    user: mapUser(userDoc),
    sessionToken: rawSessionToken,
    sessionExpiresAt,
  };
}

export interface OtpRequestResult {
  ok: boolean;
  status: number;
  code?:
    | 'INVALID_INPUT'
    | 'DOMAIN_NOT_ALLOWED'
    | 'ACCOUNT_EXISTS'
    | 'RESEND_COOLDOWN'
    | 'EMAIL_FAILED'
    | 'EXTERNAL_EMAIL_UNAVAILABLE'
    | 'DEV_RECIPIENT_RESTRICTED'
    | 'EMAIL_CONFIG_ERROR';
  message: string;
  challengeId?: string;
  retryAfterSeconds?: number;
}

export interface OtpVerifyResult {
  ok: boolean;
  status: number;
  code?:
    | 'INVALID_INPUT'
    | 'INVALID_OTP'
    | 'OTP_EXPIRED'
    | 'OTP_USED'
    | 'OTP_LOCKED'
    | 'ACCOUNT_EXISTS';
  message: string;
  user?: AuthUser;
  sessionToken?: string;
  sessionExpiresAt?: Date;
}

async function issueSessionForUser(
  userId: string,
  nowMs = Date.now(),
): Promise<{ sessionToken: string; sessionExpiresAt: Date }> {
  const { sessions } = await getCollections();
  const rawSessionToken = generateSecureToken();
  const sessionTokenHash = hashToken(rawSessionToken);
  const sessionId = generateId();
  const now = new Date(nowMs);
  const sessionExpiresAt = new Date(nowMs + SESSION_TTL_MS);

  await sessions.insertOne({
    id: sessionId,
    userId,
    sessionTokenHash,
    expiresAt: sessionExpiresAt,
    createdAt: now,
  });

  return { sessionToken: rawSessionToken, sessionExpiresAt };
}

export async function requestRegistrationOtp(input: {
  name: string;
  email: string;
  nowMs?: number;
}): Promise<OtpRequestResult> {
  const cleanName = normalizeName(input.name ?? '');
  const cleanEmail = normalizeEmail(input.email ?? '');

  if (!isValidName(cleanName)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Please enter your full name (between 2 and 80 characters).',
    };
  }

  if (!isValidEmail(cleanEmail)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Please enter a valid email address.',
    };
  }

  if (!isAllowedEmailDomain(cleanEmail)) {
    return {
      ok: false,
      status: 403,
      code: 'DOMAIN_NOT_ALLOWED',
      message: ALLOWED_DOMAIN_ERROR_MESSAGE,
    };
  }

  const emailConfig = getEmailModeConfig();
  if (!emailConfig.ok) {
    return {
      ok: false,
      status: 503,
      code: 'EMAIL_CONFIG_ERROR',
      message: emailConfig.error,
    };
  }
  if (emailConfig.mode === 'development' && cleanEmail !== emailConfig.testRecipient) {
    return {
      ok: false,
      status: 403,
      code: 'DEV_RECIPIENT_RESTRICTED',
      message: DEV_MODE_RESTRICTED_MESSAGE,
    };
  }

  const { users, emailOtps } = await getCollections();
  const existingUser = await users.findOne({ email: cleanEmail }, { projection: { id: 1 } });
  if (existingUser) {
    return {
      ok: false,
      status: 409,
      code: 'ACCOUNT_EXISTS',
      message: 'An account with this email address already exists. Please sign in instead.',
    };
  }

  const nowMs = input.nowMs ?? Date.now();
  const cooldown = await claimOtpCooldown('register', cleanEmail, OTP_RESEND_COOLDOWN_MS, nowMs);
  if (!cooldown.claimed) {
    return {
      ok: false,
      status: 429,
      code: 'RESEND_COOLDOWN',
      retryAfterSeconds: cooldown.retryAfterSeconds,
      message: `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new verification code.`,
    };
  }

  await emailOtps.deleteMany({ email: cleanEmail, purpose: 'register', consumedAt: null });

  const challengeId = generateOtpChallengeId();
  const otp = generateNumericOtp();
  const otpHash = hashOtp({ purpose: 'register', email: cleanEmail, challengeId, otp });
  const now = new Date(nowMs);

  const challengeDoc: EmailOtpDocument = {
    id: challengeId,
    purpose: 'register',
    email: cleanEmail,
    pendingName: cleanName,
    otpHash,
    attempts: 0,
    expiresAt: new Date(nowMs + OTP_TTL_MS),
    consumedAt: null,
    resendAvailableAt: new Date(nowMs + OTP_RESEND_COOLDOWN_MS),
    createdAt: now,
  };

  await emailOtps.insertOne(challengeDoc);

  const emailContent = buildOtpEmail({
    name: cleanName,
    otp,
    purpose: 'register',
    expiresInMinutes: 5,
  });

  const emailResult = await sendEmail({
    to: cleanEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  if (!emailResult.ok) {
    await emailOtps.deleteOne({ id: challengeId });
    await releaseOtpCooldown('register', cleanEmail);
    if (emailResult.restrictedRecipient) {
      return {
        ok: false,
        status: 403,
        code: 'EXTERNAL_EMAIL_UNAVAILABLE',
        message:
          'External email delivery is not currently available. Only the authorized test account email can receive verification codes right now.',
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'EMAIL_FAILED',
      message: 'We could not deliver your verification code right now. Please try again shortly.',
    };
  }

  return {
    ok: true,
    status: 200,
    challengeId,
    message: 'A 6-digit verification code has been sent to your email address.',
  };
}

export async function verifyRegistrationOtp(input: {
  email: string;
  otp: string;
  challengeId?: string;
  nowMs?: number;
}): Promise<OtpVerifyResult> {
  const cleanEmail = normalizeEmail(input.email ?? '');
  const cleanOtp = (input.otp ?? '').trim();
  const cleanChallengeId = input.challengeId?.trim();

  if (!isValidEmail(cleanEmail) || !isValidOtpFormat(cleanOtp)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Please enter a valid email address and 6-digit verification code.',
    };
  }

  const { users, emailOtps } = await getCollections();
  const nowMs = input.nowMs ?? Date.now();
  const now = new Date(nowMs);

  const filter = cleanChallengeId
    ? { id: cleanChallengeId, email: cleanEmail, purpose: 'register' as const }
    : { email: cleanEmail, purpose: 'register' as const, consumedAt: null };

  const challenge = await emailOtps.findOne(filter);
  if (!challenge) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_OTP',
      message: 'Invalid verification code. Please request a new code.',
    };
  }

  if (challenge.consumedAt) {
    return {
      ok: false,
      status: 401,
      code: 'OTP_USED',
      message: 'This verification code has already been used. Please request a new code.',
    };
  }

  if (challenge.expiresAt.getTime() <= nowMs) {
    return {
      ok: false,
      status: 401,
      code: 'OTP_EXPIRED',
      message: 'This verification code has expired. Codes are valid for 5 minutes.',
    };
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      status: 429,
      code: 'OTP_LOCKED',
      message: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

  const candidateHash = hashOtp({
    purpose: 'register',
    email: cleanEmail,
    challengeId: challenge.id,
    otp: cleanOtp,
  });

  if (!verifyOtpHashConstantTime(challenge.otpHash, candidateHash)) {
    const updated = await emailOtps.findOneAndUpdate(
      { id: challenge.id, consumedAt: null, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
    const attempts = updated?.attempts ?? OTP_MAX_ATTEMPTS;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return {
        ok: false,
        status: 429,
        code: 'OTP_LOCKED',
        message: 'Too many incorrect attempts. Please request a new verification code.',
      };
    }
    return {
      ok: false,
      status: 401,
      code: 'INVALID_OTP',
      message: 'Invalid verification code. Please check the 6-digit code and try again.',
    };
  }

  // Atomic single-use OTP consumption
  const consumed = await emailOtps.findOneAndUpdate(
    {
      id: challenge.id,
      email: cleanEmail,
      purpose: 'register',
      consumedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: OTP_MAX_ATTEMPTS },
    },
    { $set: { consumedAt: now } },
    { returnDocument: 'after' },
  );

  if (!consumed || !consumed.pendingName) {
    return {
      ok: false,
      status: 401,
      code: 'OTP_USED',
      message: 'This verification code is no longer valid. Please request a new code.',
    };
  }

  const userId = generateId();
  const userDoc: UserDocument = {
    id: userId,
    name: consumed.pendingName,
    email: cleanEmail,
    emailVerifiedAt: now,
    role: DEFAULT_USER_ROLE,
    authProviders: ['email-otp'],
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await users.insertOne(userDoc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return {
        ok: false,
        status: 409,
        code: 'ACCOUNT_EXISTS',
        message: 'An account with this email address already exists. Please sign in instead.',
      };
    }
    throw error;
  }

  const { sessionToken, sessionExpiresAt } = await issueSessionForUser(userDoc.id, nowMs);

  return {
    ok: true,
    status: 201,
    message: 'Your Vistra Learn account has been verified and created.',
    user: mapUser(userDoc),
    sessionToken,
    sessionExpiresAt,
  };
}

export async function requestLoginOtp(input: {
  email: string;
  nowMs?: number;
}): Promise<OtpRequestResult> {
  const cleanEmail = normalizeEmail(input.email ?? '');
  if (!isValidEmail(cleanEmail)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Please enter a valid email address.',
    };
  }

  const emailConfig = getEmailModeConfig();
  if (!emailConfig.ok) {
    return {
      ok: false,
      status: 503,
      code: 'EMAIL_CONFIG_ERROR',
      message: emailConfig.error,
    };
  }
  if (emailConfig.mode === 'development' && cleanEmail !== emailConfig.testRecipient) {
    return {
      ok: false,
      status: 403,
      code: 'DEV_RECIPIENT_RESTRICTED',
      message: DEV_MODE_RESTRICTED_MESSAGE,
    };
  }

  const neutralMessage =
    'If an account exists for this email address, a 6-digit sign-in code has been sent.';

  const nowMs = input.nowMs ?? Date.now();
  const cooldown = await claimOtpCooldown('login', cleanEmail, OTP_RESEND_COOLDOWN_MS, nowMs);
  if (!cooldown.claimed) {
    return {
      ok: false,
      status: 429,
      code: 'RESEND_COOLDOWN',
      retryAfterSeconds: cooldown.retryAfterSeconds,
      message: `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new sign-in code.`,
    };
  }

  const { users, emailOtps } = await getCollections();
  const user = await users.findOne({ email: cleanEmail });
  if (!user) {
    return {
      ok: true,
      status: 200,
      message: neutralMessage,
    };
  }

  await emailOtps.deleteMany({ email: cleanEmail, purpose: 'login', consumedAt: null });

  const challengeId = generateOtpChallengeId();
  const otp = generateNumericOtp();
  const otpHash = hashOtp({ purpose: 'login', email: cleanEmail, challengeId, otp });
  const now = new Date(nowMs);

  await emailOtps.insertOne({
    id: challengeId,
    purpose: 'login',
    email: cleanEmail,
    userId: user.id,
    otpHash,
    attempts: 0,
    expiresAt: new Date(nowMs + OTP_TTL_MS),
    consumedAt: null,
    resendAvailableAt: new Date(nowMs + OTP_RESEND_COOLDOWN_MS),
    createdAt: now,
  });

  const emailContent = buildOtpEmail({
    name: user.name,
    otp,
    purpose: 'login',
    expiresInMinutes: 5,
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  if (!emailResult.ok) {
    await emailOtps.deleteOne({ id: challengeId });
    await releaseOtpCooldown('login', cleanEmail);
    console.error('[auth:otp-login-email]', {
      restrictedRecipient: Boolean(emailResult.restrictedRecipient),
    });
    return {
      ok: true,
      status: 200,
      message: neutralMessage,
    };
  }

  return {
    ok: true,
    status: 200,
    message: neutralMessage,
  };
}

export async function verifyLoginOtp(input: {
  email: string;
  otp: string;
  challengeId?: string;
  nowMs?: number;
}): Promise<OtpVerifyResult> {
  const cleanEmail = normalizeEmail(input.email ?? '');
  const cleanOtp = (input.otp ?? '').trim();
  const cleanChallengeId = input.challengeId?.trim();

  if (!isValidEmail(cleanEmail) || !isValidOtpFormat(cleanOtp)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Please enter a valid email address and 6-digit verification code.',
    };
  }

  const { users, emailOtps } = await getCollections();
  const nowMs = input.nowMs ?? Date.now();
  const now = new Date(nowMs);

  const filter = cleanChallengeId
    ? { id: cleanChallengeId, email: cleanEmail, purpose: 'login' as const }
    : { email: cleanEmail, purpose: 'login' as const, consumedAt: null };

  const challenge = await emailOtps.findOne(filter);
  if (!challenge) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_OTP',
      message: 'Invalid verification code. Please request a new code.',
    };
  }

  if (challenge.consumedAt) {
    return {
      ok: false,
      status: 401,
      code: 'OTP_USED',
      message: 'This verification code has already been used. Please request a new code.',
    };
  }

  if (challenge.expiresAt.getTime() <= nowMs) {
    return {
      ok: false,
      status: 401,
      code: 'OTP_EXPIRED',
      message: 'This verification code has expired. Codes are valid for 5 minutes.',
    };
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      status: 429,
      code: 'OTP_LOCKED',
      message: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

  const candidateHash = hashOtp({
    purpose: 'login',
    email: cleanEmail,
    challengeId: challenge.id,
    otp: cleanOtp,
  });

  if (!verifyOtpHashConstantTime(challenge.otpHash, candidateHash)) {
    const updated = await emailOtps.findOneAndUpdate(
      { id: challenge.id, consumedAt: null, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
    const attempts = updated?.attempts ?? OTP_MAX_ATTEMPTS;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return {
        ok: false,
        status: 429,
        code: 'OTP_LOCKED',
        message: 'Too many incorrect attempts. Please request a new verification code.',
      };
    }
    return {
      ok: false,
      status: 401,
      code: 'INVALID_OTP',
      message: 'Invalid verification code. Please check the 6-digit code and try again.',
    };
  }

  // Atomic single-use OTP consumption
  const consumed = await emailOtps.findOneAndUpdate(
    {
      id: challenge.id,
      email: cleanEmail,
      purpose: 'login',
      consumedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: OTP_MAX_ATTEMPTS },
    },
    { $set: { consumedAt: now } },
    { returnDocument: 'after' },
  );

  if (!consumed || !consumed.userId) {
    return {
      ok: false,
      status: 401,
      code: 'OTP_USED',
      message: 'This verification code is no longer valid. Please request a new code.',
    };
  }

  const existingUser = await users.findOne({ id: consumed.userId });
  if (!existingUser) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_OTP',
      message: 'Account could not be found for this verification code.',
    };
  }

  // Preserve existing user ID, role, googleSub, and existing authProviders.
  const existingProviders =
    Array.isArray(existingUser.authProviders) && existingUser.authProviders.length > 0
      ? existingUser.authProviders
      : existingUser.googleSub
        ? ['google']
        : ['email'];
  const mergedProviders = existingProviders.includes('email-otp')
    ? existingProviders
    : [...existingProviders, 'email-otp'];

  await users.updateOne(
    { id: existingUser.id },
    {
      $set: {
        authProviders: mergedProviders,
        emailVerifiedAt: existingUser.emailVerifiedAt ?? now,
        updatedAt: now,
      },
    },
  );

  const updatedUser = (await users.findOne({ id: existingUser.id })) ?? existingUser;
  const { sessionToken, sessionExpiresAt } = await issueSessionForUser(updatedUser.id, nowMs);

  return {
    ok: true,
    status: 200,
    message: 'Signed in to Vistra Learn.',
    user: mapUser(updatedUser),
    sessionToken,
    sessionExpiresAt,
  };
}

import { getCollections, type UserDocument } from '../mongodb';
import { sendEmail } from '../email/resend';
import { buildMagicLinkEmail, buildWelcomeEmail } from '../email/templates';
import {
  generateId,
  generateSecureToken,
  hashToken,
  isValidEmail,
  isValidName,
  normalizeEmail,
  normalizeName,
} from './crypto';

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
  code?: 'INVALID_INPUT' | 'ACCOUNT_EXISTS' | 'EMAIL_FAILED' | 'EXTERNAL_EMAIL_UNAVAILABLE' | 'DEV_RECIPIENT_RESTRICTED' | 'EMAIL_CONFIG_ERROR';
  message: string;
  user?: Pick<AuthUser, 'id' | 'name' | 'email' | 'role'>;
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

  if (expiresMs - nowMs < SESSION_RENEWAL_THRESHOLD_MS) {
    newExpiresAt = new Date(nowMs + SESSION_TTL_MS);
    await sessions.updateOne(
      { id: sessionDoc.id },
      { $set: { expiresAt: newExpiresAt } },
    );
    renewed = true;
  }

  return {
    sessionId: sessionDoc.id,
    user: mapUser(userDoc),
    expiresAt: (newExpiresAt ?? sessionDoc.expiresAt).toISOString(),
    renewed,
    newExpiresAt,
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

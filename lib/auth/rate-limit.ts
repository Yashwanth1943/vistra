import { getCollections } from '../mongodb';
import { hashRateLimitKey } from './crypto';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window MongoDB-backed rate limiter to protect auth endpoints across serverless instances.
 */
export async function checkRateLimit(
  namespace: string,
  identifier: string,
  maxRequests: number,
  windowMs: number,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const { rateLimits } = await getCollections();
  const key = `${namespace}:${hashRateLimitKey(identifier)}`;
  const now = new Date(nowMs);
  const nextResetAt = new Date(nowMs + windowMs);

  const existing = await rateLimits.findOne({ key });

  if (!existing || existing.resetAt.getTime() <= nowMs) {
    await rateLimits.updateOne(
      { key },
      { $set: { key, count: 1, resetAt: nextResetAt } },
      { upsert: true },
    );
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt.getTime() - nowMs) / 1000)),
    };
  }

  const updated = await rateLimits.findOneAndUpdate(
    { key, resetAt: { $gt: now } },
    { $inc: { count: 1 } },
    { returnDocument: 'after' },
  );

  const count = updated?.count ?? existing.count + 1;
  if (count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt.getTime() - nowMs) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt.getTime() - nowMs) / 1000)),
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

export interface CooldownClaimResult {
  claimed: boolean;
  retryAfterSeconds: number;
}

/**
 * Atomically claims a per-(purpose, email) resend cooldown window using MongoDB's
 * unique key index and conditional findOneAndUpdate so concurrent requests cannot both win.
 */
export async function claimOtpCooldown(
  purpose: 'register' | 'login',
  normalizedEmail: string,
  cooldownMs: number,
  nowMs = Date.now(),
): Promise<CooldownClaimResult> {
  const { rateLimits } = await getCollections();
  const key = `otp:cooldown:${purpose}:${hashRateLimitKey(normalizedEmail)}`;
  const now = new Date(nowMs);
  const nextResetAt = new Date(nowMs + cooldownMs);

  // Case 1: An expired cooldown record exists -> atomically claim by resetting it.
  const resetExisting = await rateLimits.findOneAndUpdate(
    { key, resetAt: { $lte: now } },
    { $set: { count: 1, resetAt: nextResetAt } },
    { returnDocument: 'after' },
  );
  if (resetExisting) {
    return {
      claimed: true,
      retryAfterSeconds: Math.ceil(cooldownMs / 1000),
    };
  }

  // Case 2: Check if an active cooldown is already held.
  const active = await rateLimits.findOne({ key });
  if (active && active.resetAt.getTime() > nowMs) {
    return {
      claimed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((active.resetAt.getTime() - nowMs) / 1000)),
    };
  }

  // Case 3: No record exists -> atomic insert protected by unique index on `key`.
  try {
    await rateLimits.insertOne({ key, count: 1, resetAt: nextResetAt });
    return {
      claimed: true,
      retryAfterSeconds: Math.ceil(cooldownMs / 1000),
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const winner = await rateLimits.findOne({ key });
      const retryAfterSeconds = winner
        ? Math.max(1, Math.ceil((winner.resetAt.getTime() - nowMs) / 1000))
        : Math.ceil(cooldownMs / 1000);
      return { claimed: false, retryAfterSeconds };
    }
    throw error;
  }
}

export async function releaseOtpCooldown(
  purpose: 'register' | 'login',
  normalizedEmail: string,
): Promise<void> {
  const { rateLimits } = await getCollections();
  const key = `otp:cooldown:${purpose}:${hashRateLimitKey(normalizedEmail)}`;
  await rateLimits.deleteOne({ key });
}

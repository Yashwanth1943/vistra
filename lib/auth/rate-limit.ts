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

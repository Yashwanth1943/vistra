import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be configured with at least 16 characters in production.');
  }
  return 'vistra-dev-only-insecure-fallback-secret-change-me';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length >= 5 && normalized.length <= 254 && EMAIL_REGEX.test(normalized);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function isValidName(name: string): boolean {
  const clean = normalizeName(name);
  return clean.length >= 2 && clean.length <= 80;
}

export function generateId(): string {
  return randomUUID();
}

/**
 * Generates a 256-bit cryptographically secure URL-safe random token.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Computes an HMAC-SHA256 digest of a raw token so raw tokens are never stored in the database.
 */
export function hashToken(rawToken: string): string {
  const secret = getSessionSecret();
  return createHmac('sha256', secret).update(rawToken).digest('hex');
}

/**
 * Deterministic non-secret hash for rate-limit bucket keys (e.g., normalized email or IP).
 */
export function hashRateLimitKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

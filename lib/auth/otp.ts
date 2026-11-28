import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { generateId, getSessionSecret, normalizeEmail } from './crypto';

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

export type OtpPurpose = 'register' | 'login';

/**
 * Generates a cryptographically secure 6-digit numeric OTP using Node.js crypto.randomInt.
 */
export function generateNumericOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Generates an unpredictable challenge identifier.
 */
export function generateOtpChallengeId(): string {
  return generateId();
}

export function isValidOtpFormat(otp: string): boolean {
  return /^\d{6}$/.test((otp ?? '').trim());
}

/**
 * Computes a domain-separated HMAC-SHA256 hash of a 6-digit OTP bound to its
 * purpose, normalized email, and challenge ID using SESSION_SECRET.
 */
export function hashOtp(input: {
  purpose: OtpPurpose;
  email: string;
  challengeId: string;
  otp: string;
}): string {
  const secret = getSessionSecret();
  const payload = `otp:v1:${input.purpose}:${normalizeEmail(input.email)}:${input.challengeId}:${input.otp.trim()}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Compares two hex-encoded OTP HMAC digests in constant time.
 */
export function verifyOtpHashConstantTime(expectedHex: string, actualHex: string): boolean {
  if (!expectedHex || !actualHex || expectedHex.length !== actualHex.length) {
    return false;
  }
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = Buffer.from(actualHex, 'hex');
  if (expectedBuf.length === 0 || expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}

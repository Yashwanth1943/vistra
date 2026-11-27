import { isValidEmail, normalizeEmail } from './crypto';

export const ALLOWED_DOMAIN_ERROR_MESSAGE =
  'Vistra registration is currently available only to verified Gmail accounts.';

/**
 * Returns the exact set of approved email domains from ALLOWED_EMAIL_DOMAINS (defaults to gmail.com).
 */
export function getAllowedEmailDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS?.trim() || 'gmail.com';
  const domains = raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0 && !d.includes('@') && !d.startsWith('.'));
  return domains.length > 0 ? [...new Set(domains)] : ['gmail.com'];
}

/**
 * Enforces an exact domain match (no subdomains or lookalike suffixes).
 */
export function isAllowedEmailDomain(email: string): boolean {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) {
    return false;
  }
  const atIndex = clean.lastIndexOf('@');
  if (atIndex === -1) {
    return false;
  }
  const domain = clean.slice(atIndex + 1);
  return getAllowedEmailDomains().includes(domain);
}

import { NextResponse } from 'next/server';

export interface SanitizedAuthError {
  name: string;
  code?: string;
  syscall?: string;
  hostname?: string;
}

/**
 * Extracts only non-sensitive error metadata (including DNS fields) so credentials,
 * MongoDB URIs, session tokens, and request secrets are never logged.
 */
export function sanitizeAuthError(error: unknown): SanitizedAuthError {
  const name = error instanceof Error ? error.name : 'UnknownError';
  if (typeof error !== 'object' || error === null) {
    return { name };
  }

  const err = error as { code?: unknown; syscall?: unknown; hostname?: unknown };
  const sanitized: SanitizedAuthError = { name };

  if (err.code !== undefined) {
    sanitized.code = String(err.code);
  }
  if (typeof err.syscall === 'string' && err.syscall.trim()) {
    sanitized.syscall = err.syscall.trim();
  }
  if (typeof err.hostname === 'string' && err.hostname.trim()) {
    sanitized.hostname = err.hostname.replace(/^[^@]+@/, '').split('/')[0].trim();
  }

  return sanitized;
}

/**
 * Logs only non-sensitive error metadata (never credentials, connection strings, or tokens)
 * and returns a safe JSON response without internal stack traces.
 */
export function handleAuthRouteError(routeName: string, error: unknown): NextResponse {
  console.error(`[auth:${routeName}]`, sanitizeAuthError(error));

  return NextResponse.json(
    {
      ok: false,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Authentication service is temporarily unavailable. Please try again shortly.',
    },
    { status: 503 },
  );
}

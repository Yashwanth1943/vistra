import { cookies, headers } from 'next/headers';
import type { NextResponse } from 'next/server';
import {
  invalidateSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  validateSessionToken,
  type ValidatedSession,
} from './service';

export function buildSessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    expires: expiresAt ?? new Date(Date.now() + SESSION_TTL_MS),
  };
}

export function setSessionCookie(response: NextResponse, rawSessionToken: string, expiresAt?: Date): void {
  response.cookies.set(SESSION_COOKIE_NAME, rawSessionToken, buildSessionCookieOptions(expiresAt));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getServerSession(): Promise<ValidatedSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return validateSessionToken(rawToken);
}

export type ServerSessionResult =
  | { status: 'authenticated'; session: ValidatedSession }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' };

/**
 * Fail-closed session reader for Server Components.
 * Never treats a database/config error as authenticated, and distinguishes outages
 * from ordinary unauthenticated state while logging only sanitized metadata.
 */
export async function getServerSessionResult(): Promise<ServerSessionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { status: 'unauthenticated' };
    }
    return { status: 'authenticated', session };
  } catch (error) {
    console.error('[auth:session]', {
      name: error instanceof Error ? error.name : 'UnknownError',
      code:
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : undefined,
    });
    return { status: 'unavailable' };
  }
}

export async function destroyServerSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  await invalidateSessionToken(rawToken);
}

export async function getClientIp(request?: Request): Promise<string> {
  if (request) {
    const fwd = request.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip')?.trim() ?? '127.0.0.1';
}

import { NextResponse } from 'next/server';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { verifyMagicLinkAndCreateSession } from '@/lib/auth/service';
import { getClientIp, setSessionCookie } from '@/lib/auth/session';

const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_MAX_PER_IP = 15;

export async function POST(request: Request) {
  try {
    const ip = await getClientIp(request);
    const ipLimit = await checkRateLimit('verify:ip', ip, VERIFY_MAX_PER_IP, VERIFY_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { ok: false, reason: 'rate_limited', message: 'Too many verification attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        },
      );
    }

    let body: { token?: unknown };
    try {
      body = (await request.json()) as { token?: unknown };
    } catch {
      return NextResponse.json(
        { ok: false, reason: 'invalid', message: 'Invalid verification request.' },
        { status: 400 },
      );
    }

    const token = typeof body.token === 'string' ? body.token : '';
    const result = await verifyMagicLinkAndCreateSession(token);

    if (!result.ok || !result.sessionToken || !result.user) {
      const messages: Record<string, string> = {
        missing: 'No verification token was provided.',
        invalid: 'This sign-in link is invalid. Please request a new magic link.',
        expired: 'This sign-in link has expired. Magic links are valid for 10 minutes.',
        used: 'This sign-in link has already been used. Please request a new magic link.',
      };
      const reason = result.reason ?? 'invalid';
      return NextResponse.json(
        {
          ok: false,
          reason,
          message: messages[reason] ?? messages.invalid,
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: 200 },
    );

    setSessionCookie(response, result.sessionToken, result.sessionExpiresAt);
    return response;
  } catch (error) {
    return handleAuthRouteError('verify', error);
  }
}

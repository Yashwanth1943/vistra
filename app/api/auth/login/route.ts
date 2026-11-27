import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/auth/crypto';
import { verifySameOriginRequest } from '@/lib/auth/csrf';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { requestMagicLoginLink } from '@/lib/auth/service';
import { getClientIp } from '@/lib/auth/session';

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_PER_IP = 15;
const LOGIN_MAX_PER_EMAIL = 5;

export async function POST(request: Request) {
  if (!verifySameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }
  try {
    const ip = await getClientIp(request);
    const ipLimit = await checkRateLimit('login:ip', ip, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { ok: false, message: 'Too many login link requests. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        },
      );
    }

    let body: { email?: unknown };
    try {
      body = (await request.json()) as { email?: unknown };
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const email = typeof body.email === 'string' ? body.email : '';
    const normalized = normalizeEmail(email);
    if (normalized) {
      const emailLimit = await checkRateLimit('login:email', normalized, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_MS);
      if (!emailLimit.allowed) {
        return NextResponse.json(
          { ok: false, message: 'Too many login link requests for this email. Please check your inbox or wait a few minutes.' },
          {
            status: 429,
            headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) },
          },
        );
      }
    }

    const origin = new URL(request.url).origin;
    const result = await requestMagicLoginLink({ email, origin });

    return NextResponse.json(
      {
        ok: result.ok,
        code: result.code,
        message: result.message,
      },
      { status: result.status },
    );
  } catch (error) {
    return handleAuthRouteError('login', error);
  }
}

import { NextResponse } from 'next/server';
import { verifySameOriginRequest } from '@/lib/auth/csrf';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { registerUserAccount } from '@/lib/auth/service';
import { getClientIp } from '@/lib/auth/session';

const REGISTER_WINDOW_MS = 10 * 60 * 1000;
const REGISTER_MAX_PER_IP = 5;

export async function POST(request: Request) {
  if (!verifySameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }
  try {
    const ip = await getClientIp(request);
    const ipLimit = await checkRateLimit('register:ip', ip, REGISTER_MAX_PER_IP, REGISTER_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { ok: false, message: 'Too many registration attempts. Please try again shortly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        },
      );
    }

    let body: { name?: unknown; email?: unknown };
    try {
      body = (await request.json()) as { name?: unknown; email?: unknown };
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const name = typeof body.name === 'string' ? body.name : '';
    const email = typeof body.email === 'string' ? body.email : '';

    const result = await registerUserAccount({ name, email });
    return NextResponse.json(
      {
        ok: result.ok,
        code: result.code,
        message: result.message,
        user: result.user,
      },
      { status: result.status },
    );
  } catch (error) {
    return handleAuthRouteError('register', error);
  }
}

import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/auth/crypto';
import { verifySameOriginRequest } from '@/lib/auth/csrf';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { parseBoundedJsonBody } from '@/lib/auth/request-guard';
import { requestLoginOtp } from '@/lib/auth/service';
import { getClientIp } from '@/lib/auth/session';

const OTP_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const OTP_LOGIN_MAX_PER_IP = 15;
const OTP_LOGIN_MAX_PER_EMAIL = 5;

export async function POST(request: Request) {
  if (!verifySameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const ip = await getClientIp(request);
    const ipLimit = await checkRateLimit('otp:login:req:ip', ip, OTP_LOGIN_MAX_PER_IP, OTP_LOGIN_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { ok: false, message: 'Too many sign-in code requests. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
      );
    }

    const parsedBody = await parseBoundedJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }
    const body = parsedBody.data;

    const email = typeof body.email === 'string' ? body.email : '';
    const normalized = normalizeEmail(email);

    if (normalized) {
      const emailLimit = await checkRateLimit(
        'otp:login:req:email',
        normalized,
        OTP_LOGIN_MAX_PER_EMAIL,
        OTP_LOGIN_WINDOW_MS,
      );
      if (!emailLimit.allowed) {
        return NextResponse.json(
          { ok: false, message: 'Too many sign-in code requests for this email. Please wait and try again.' },
          { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } },
        );
      }
    }

    const result = await requestLoginOtp({ email });
    const headers = result.retryAfterSeconds
      ? { 'Retry-After': String(result.retryAfterSeconds) }
      : undefined;

    return NextResponse.json(
      {
        ok: result.ok,
        code: result.code,
        message: result.message,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status: result.status, headers },
    );
  } catch (error) {
    return handleAuthRouteError('otp-login-request', error);
  }
}

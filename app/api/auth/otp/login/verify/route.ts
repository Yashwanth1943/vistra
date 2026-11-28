import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/auth/crypto';
import { verifySameOriginRequest } from '@/lib/auth/csrf';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { parseBoundedJsonBody } from '@/lib/auth/request-guard';
import { verifyLoginOtp } from '@/lib/auth/service';
import { getClientIp, setSessionCookie } from '@/lib/auth/session';

const OTP_LOGIN_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const OTP_LOGIN_VERIFY_MAX_PER_IP = 15;
const OTP_LOGIN_VERIFY_MAX_PER_EMAIL = 10;

export async function POST(request: Request) {
  if (!verifySameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const ip = await getClientIp(request);
    const ipLimit = await checkRateLimit(
      'otp:login:verify:ip',
      ip,
      OTP_LOGIN_VERIFY_MAX_PER_IP,
      OTP_LOGIN_VERIFY_WINDOW_MS,
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { ok: false, message: 'Too many verification attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
      );
    }

    const parsedBody = await parseBoundedJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }
    const body = parsedBody.data;

    const email = typeof body.email === 'string' ? body.email : '';
    const otp = typeof body.otp === 'string' ? body.otp : '';
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : undefined;
    const normalized = normalizeEmail(email);

    if (normalized) {
      const emailLimit = await checkRateLimit(
        'otp:login:verify:email',
        normalized,
        OTP_LOGIN_VERIFY_MAX_PER_EMAIL,
        OTP_LOGIN_VERIFY_WINDOW_MS,
      );
      if (!emailLimit.allowed) {
        return NextResponse.json(
          { ok: false, message: 'Too many verification attempts for this email. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } },
        );
      }
    }

    const result = await verifyLoginOtp({ email, otp, challengeId });
    if (!result.ok || !result.sessionToken || !result.user) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: result.status },
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        message: result.message,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: result.status },
    );

    setSessionCookie(response, result.sessionToken, result.sessionExpiresAt);
    return response;
  } catch (error) {
    return handleAuthRouteError('otp-login-verify', error);
  }
}

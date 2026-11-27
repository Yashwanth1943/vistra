import { NextResponse } from 'next/server';
import {
  buildGoogleAuthorizationUrl,
  createOAuthTransaction,
  getGoogleOAuthConfig,
  OAUTH_TX_COOKIE_NAME,
  OAUTH_TX_TTL_SECONDS,
} from '@/lib/auth/google';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { getAppUrl } from '@/lib/auth/service';
import { getClientIp } from '@/lib/auth/session';

const GOOGLE_AUTH_WINDOW_MS = 10 * 60 * 1000;
const GOOGLE_AUTH_MAX_PER_IP = 20;

export async function GET(request: Request) {
  const origin = getAppUrl(new URL(request.url).origin);

  try {
    const ip = await getClientIp(request);
    const ipLimit = await checkRateLimit('google:start', ip, GOOGLE_AUTH_MAX_PER_IP, GOOGLE_AUTH_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.redirect(
        `${origin}/auth/error?message=${encodeURIComponent('Too many sign-in attempts. Please try again shortly.')}`,
      );
    }

    const config = getGoogleOAuthConfig(origin);
    if (!config) {
      return NextResponse.redirect(
        `${origin}/auth/error?message=${encodeURIComponent('Google Sign-In is not configured on this server.')}`,
      );
    }

    const tx = createOAuthTransaction();
    const authUrl = buildGoogleAuthorizationUrl(config, tx);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(OAUTH_TX_COOKIE_NAME, JSON.stringify(tx), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: OAUTH_TX_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('[auth:google-start]', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return handleAuthRouteError('google-start', error);
  }
}

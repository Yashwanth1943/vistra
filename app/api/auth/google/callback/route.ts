import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  constantTimeEqual,
  exchangeGoogleAuthCode,
  getGoogleOAuthConfig,
  OAUTH_TX_COOKIE_NAME,
  verifyGoogleIdToken,
  type OAuthTransaction,
} from '@/lib/auth/google';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { authenticateWithGoogleProfile, getAppUrl } from '@/lib/auth/service';
import { getClientIp, setSessionCookie } from '@/lib/auth/session';

const GOOGLE_CALLBACK_WINDOW_MS = 10 * 60 * 1000;
const GOOGLE_CALLBACK_MAX_PER_IP = 20;

function redirectWithError(origin: string, message: string): NextResponse {
  const res = NextResponse.redirect(
    `${origin}/auth/error?message=${encodeURIComponent(message)}`,
  );
  res.cookies.set(OAUTH_TX_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getAppUrl(url.origin);

  try {
    const ip = await getClientIp(request);
    const ipLimit = await checkRateLimit('google:callback', ip, GOOGLE_CALLBACK_MAX_PER_IP, GOOGLE_CALLBACK_WINDOW_MS);
    if (!ipLimit.allowed) {
      return redirectWithError(origin, 'Too many sign-in attempts. Please wait a few minutes and try again.');
    }

    const oauthError = url.searchParams.get('error');
    if (oauthError) {
      return redirectWithError(origin, 'Google sign-in was cancelled or denied.');
    }

    const code = url.searchParams.get('code')?.trim() ?? '';
    const returnedState = url.searchParams.get('state')?.trim() ?? '';
    if (!code || !returnedState) {
      return redirectWithError(origin, 'Invalid Google sign-in callback parameters.');
    }

    const cookieStore = await cookies();
    const rawTx = cookieStore.get(OAUTH_TX_COOKIE_NAME)?.value;
    if (!rawTx) {
      return redirectWithError(origin, 'Your Google sign-in session expired. Please try again.');
    }

    let tx: OAuthTransaction;
    try {
      tx = JSON.parse(rawTx) as OAuthTransaction;
    } catch {
      return redirectWithError(origin, 'Invalid OAuth transaction state. Please try again.');
    }

    if (!tx.state || !tx.codeVerifier || !tx.nonce || !constantTimeEqual(returnedState, tx.state)) {
      return redirectWithError(origin, 'OAuth state verification failed. Please try signing in again.');
    }

    const config = getGoogleOAuthConfig(origin);
    if (!config) {
      return redirectWithError(origin, 'Google Sign-In is not configured on this server.');
    }

    const tokens = await exchangeGoogleAuthCode({
      code,
      codeVerifier: tx.codeVerifier,
      config,
    });

    if (!tokens.id_token) {
      return redirectWithError(origin, 'Google did not return a valid identity token.');
    }

    const claims = await verifyGoogleIdToken({
      idToken: tokens.id_token,
      expectedAudience: config.clientId,
      expectedNonce: tx.nonce,
    });

    const authResult = await authenticateWithGoogleProfile({
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      name: claims.name,
      picture: claims.picture,
    });

    if (!authResult.ok || !authResult.sessionToken) {
      return redirectWithError(
        origin,
        authResult.message || 'Could not sign in with this Google account.',
      );
    }

    const response = NextResponse.redirect(`${origin}/`);
    response.cookies.set(OAUTH_TX_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
    setSessionCookie(response, authResult.sessionToken, authResult.sessionExpiresAt);
    return response;
  } catch (error) {
    console.error('[auth:google-callback]', {
      name: error instanceof Error ? error.name : 'UnknownError',
      code:
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : undefined,
    });
    return redirectWithError(
      origin,
      'Google sign-in could not be completed. Please try again.',
    );
  }
}

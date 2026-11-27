import { createHash, createPublicKey, timingSafeEqual, verify as cryptoVerify, type JsonWebKey } from 'node:crypto';
import { generateSecureToken } from './crypto';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
export const OAUTH_TX_COOKIE_NAME = 'vistra_oauth_tx';
export const OAUTH_TX_TTL_SECONDS = 600; // 10 minutes

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleIdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
  exp: number;
  iat?: number;
}

export interface OAuthTransaction {
  state: string;
  codeVerifier: string;
  nonce: string;
}

export type GoogleTokenExchangeFn = (params: {
  code: string;
  codeVerifier: string;
  config: GoogleOAuthConfig;
}) => Promise<{ id_token?: string }>;

export type GoogleJwksFetcherFn = () => Promise<{ keys: (JsonWebKey & { kid?: string; alg?: string })[] }>;

let jwksCache: { keys: (JsonWebKey & { kid?: string; alg?: string })[]; expiresAt: number } | null = null;
let customTokenExchangeForTests: GoogleTokenExchangeFn | null = null;
let customJwksFetcherForTests: GoogleJwksFetcherFn | null = null;

export function setGoogleOAuthTestHooks(hooks: {
  tokenExchange?: GoogleTokenExchangeFn | null;
  jwksFetcher?: GoogleJwksFetcherFn | null;
}): void {
  if ('tokenExchange' in hooks) {
    customTokenExchangeForTests = hooks.tokenExchange ?? null;
  }
  if ('jwksFetcher' in hooks) {
    customJwksFetcherForTests = hooks.jwksFetcher ?? null;
    jwksCache = null;
  }
}

export function getGoogleOAuthConfig(fallbackOrigin?: string): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  const configuredRedirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  const appUrl = process.env.APP_URL?.trim()?.replace(/\/+$/, '');
  const baseOrigin = appUrl || fallbackOrigin?.replace(/\/+$/, '') || 'http://localhost:3000';
  const redirectUri = configuredRedirect || `${baseOrigin}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function createOAuthTransaction(): OAuthTransaction {
  return {
    state: generateSecureToken(),
    codeVerifier: generateSecureToken(),
    nonce: generateSecureToken(),
  };
}

export function computePkceChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function buildGoogleAuthorizationUrl(
  config: GoogleOAuthConfig,
  tx: OAuthTransaction,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: tx.state,
    nonce: tx.nonce,
    code_challenge: computePkceChallenge(tx.codeVerifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function exchangeGoogleAuthCode(params: {
  code: string;
  codeVerifier: string;
  config: GoogleOAuthConfig;
}): Promise<{ id_token?: string }> {
  if (customTokenExchangeForTests) {
    return customTokenExchangeForTests(params);
  }

  const body = new URLSearchParams({
    code: params.code,
    client_id: params.config.clientId,
    client_secret: params.config.clientSecret,
    redirect_uri: params.config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with status ${response.status}.`);
  }

  return (await response.json()) as { id_token?: string };
}

async function fetchGoogleJwks(): Promise<(JsonWebKey & { kid?: string; alg?: string })[]> {
  if (customJwksFetcherForTests) {
    const res = await customJwksFetcherForTests();
    return res.keys;
  }

  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const response = await fetch(GOOGLE_JWKS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google JWKS (${response.status}).`);
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 300_000;
  const data = (await response.json()) as { keys?: (JsonWebKey & { kid?: string; alg?: string })[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache = { keys, expiresAt: now + ttlMs };
  return keys;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as T;
}

/**
 * Verifies Google OIDC ID token RS256 signature via JWKS and validates issuer, audience,
 * expiration, nonce, and verified email claims.
 */
export async function verifyGoogleIdToken(input: {
  idToken: string;
  expectedAudience: string;
  expectedNonce?: string;
  nowSeconds?: number;
}): Promise<GoogleIdTokenClaims> {
  const parts = (input.idToken ?? '').split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Google ID token.');
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string; typ?: string }>(headerSeg);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Google ID token algorithm or missing key ID.');
  }

  const keys = await fetchGoogleJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error('Matching Google signing key not found.');
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signingInput = Buffer.from(`${headerSeg}.${payloadSeg}`);
  const signature = Buffer.from(sigSeg, 'base64url');
  const signatureValid = cryptoVerify('RSA-SHA256', signingInput, publicKey, signature);
  if (!signatureValid) {
    throw new Error('Invalid Google ID token signature.');
  }

  const claims = decodeBase64UrlJson<GoogleIdTokenClaims>(payloadSeg);
  const nowSec = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
    throw new Error('Invalid Google ID token issuer.');
  }

  if (claims.aud !== input.expectedAudience) {
    throw new Error('Invalid Google ID token audience.');
  }

  if (typeof claims.exp !== 'number' || claims.exp <= nowSec) {
    throw new Error('Google ID token has expired.');
  }

  if (input.expectedNonce && (!claims.nonce || !constantTimeEqual(claims.nonce, input.expectedNonce))) {
    throw new Error('Google ID token nonce mismatch.');
  }

  if (!claims.sub || !claims.email) {
    throw new Error('Google ID token is missing required identity claims.');
  }

  if (claims.email_verified !== true) {
    throw new Error('Google account email is not verified.');
  }

  return claims;
}

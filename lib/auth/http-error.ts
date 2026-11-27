import { NextResponse } from 'next/server';

/**
 * Logs only non-sensitive error metadata (never credentials, connection strings, or tokens)
 * and returns a safe JSON response without internal stack traces.
 */
export function handleAuthRouteError(routeName: string, error: unknown): NextResponse {
  const errName = error instanceof Error ? error.name : 'UnknownError';
  const errCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;

  console.error(`[auth:${routeName}]`, { name: errName, code: errCode });

  return NextResponse.json(
    {
      ok: false,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Authentication service is temporarily unavailable. Please try again shortly.',
    },
    { status: 503 },
  );
}

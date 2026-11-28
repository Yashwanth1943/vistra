import { NextResponse } from 'next/server';

export const AUTH_MAX_BODY_BYTES = 2048;

export type BoundedJsonResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/**
 * Validates Content-Type, enforces a strict payload byte limit before JSON parsing,
 * and handles malformed JSON safely without exposing stack traces.
 */
export async function parseBoundedJsonBody(
  request: Request,
  maxBytes = AUTH_MAX_BODY_BYTES,
): Promise<BoundedJsonResult> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Content-Type must be application/json.' },
        { status: 415 },
      ),
    };
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, message: 'Request payload is too large.' },
          { status: 413 },
        ),
      };
    }
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Unable to read request body.' },
        { status: 400 },
      ),
    };
  }

  if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Request payload is too large.' },
        { status: 413 },
      ),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Malformed JSON request body.' },
        { status: 400 },
      ),
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Request body must be a JSON object.' },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed as Record<string, unknown> };
}

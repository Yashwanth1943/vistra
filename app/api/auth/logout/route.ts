import { NextResponse } from 'next/server';
import { verifySameOriginRequest } from '@/lib/auth/csrf';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { clearSessionCookie, destroyServerSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  if (!verifySameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  try {
    await destroyServerSession();
    const response = NextResponse.json({ ok: true }, { status: 200 });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleAuthRouteError('logout', error);
  }
}

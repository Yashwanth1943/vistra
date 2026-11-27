import { NextResponse } from 'next/server';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { getServerSession, setSessionCookie } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          emailVerifiedAt: session.user.emailVerifiedAt,
        },
      },
      { status: 200 },
    );

    if (session.renewed && session.newExpiresAt && session.rotatedSessionToken) {
      setSessionCookie(response, session.rotatedSessionToken, session.newExpiresAt);
    }

    return response;
  } catch (error) {
    return handleAuthRouteError('me', error);
  }
}

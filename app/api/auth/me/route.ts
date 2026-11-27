import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/service';
import { getServerSession, setSessionCookie } from '@/lib/auth/session';

export async function GET() {
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

  if (session.renewed && session.newExpiresAt) {
    const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
      setSessionCookie(response, rawToken, session.newExpiresAt);
    }
  }

  return response;
}

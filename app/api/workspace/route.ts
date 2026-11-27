import { NextResponse } from 'next/server';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { getServerSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      {
        ok: true,
        workspace: {
          userId: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAuthRouteError('workspace', error);
  }
}

import { NextResponse } from 'next/server';
import { verifySameOriginRequest } from '@/lib/auth/csrf';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { getServerSession } from '@/lib/auth/session';
import { getCollections } from '@/lib/mongodb';

function sanitizeIdList(value: unknown, maxItems = 100): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 80 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeOptionalLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return undefined;
  return trimmed;
}

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { studentProgress } = await getCollections();
    const doc = await studentProgress.findOne({ userId: session.user.id });

    return NextResponse.json(
      {
        ok: true,
        workspace: {
          userId: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          progress: {
            favorites: doc?.favorites ?? [],
            recent: doc?.recent ?? [],
            completed: doc?.completed ?? [],
            lastLesson: doc?.lastLesson ?? null,
            lastTab: doc?.lastTab ?? null,
            updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAuthRouteError('workspace', error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!verifySameOriginRequest(request)) {
      return NextResponse.json(
        { ok: false, error: 'Cross-origin request rejected.' },
        { status: 403 },
      );
    }

    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid progress payload.' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const favorites = sanitizeIdList(payload.favorites);
    const recent = sanitizeIdList(payload.recent, 20);
    const completed = sanitizeIdList(payload.completed);
    const lastLesson = sanitizeOptionalLabel(payload.lastLesson);
    const lastTab = sanitizeOptionalLabel(payload.lastTab);
    const updatedAt = new Date();

    const { studentProgress } = await getCollections();
    await studentProgress.updateOne(
      { userId: session.user.id },
      {
        $set: {
          userId: session.user.id,
          favorites,
          recent,
          completed,
          ...(lastLesson ? { lastLesson } : {}),
          ...(lastTab ? { lastTab } : {}),
          updatedAt,
        },
      },
      { upsert: true },
    );

    return NextResponse.json(
      {
        ok: true,
        progress: {
          favorites,
          recent,
          completed,
          lastLesson: lastLesson ?? null,
          lastTab: lastTab ?? null,
          updatedAt: updatedAt.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAuthRouteError('workspace-save', error);
  }
}

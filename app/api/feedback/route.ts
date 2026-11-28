import { NextResponse } from 'next/server';
import { verifySameOriginRequest } from '@/lib/auth/csrf';
import { handleAuthRouteError } from '@/lib/auth/http-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { parseBoundedJsonBody } from '@/lib/auth/request-guard';
import { getClientIp, getServerSession } from '@/lib/auth/session';
import { FEEDBACK_MAX_BODY_BYTES, validateFeedbackInput } from '@/lib/feedback';
import { getCollections } from '@/lib/mongodb';

const GUEST_FEEDBACK_WINDOW_MS = 10 * 60 * 1000;
const GUEST_FEEDBACK_LIMIT = 5;
const AUTH_FEEDBACK_USER_LIMIT = 10;
const AUTH_FEEDBACK_IP_LIMIT = 15;

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ ok: true, feedback: [] }, { status: 200 });
    }

    const { feedback } = await getCollections();
    const docs = await feedback
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json(
      {
        ok: true,
        feedback: docs.map((doc) => ({
          id: doc._id ? String(doc._id) : `${doc.lab}-${doc.createdAt.getTime()}`,
          category: doc.category,
          lab: doc.lab,
          description: doc.description,
          createdAt: doc.createdAt.toISOString(),
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAuthRouteError('feedback-list', error);
  }
}

export async function POST(request: Request) {
  try {
    if (!verifySameOriginRequest(request)) {
      return NextResponse.json(
        { ok: false, message: 'Cross-origin request rejected.' },
        { status: 403 },
      );
    }

    const parsedBody = await parseBoundedJsonBody(request, FEEDBACK_MAX_BODY_BYTES);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const validation = validateFeedbackInput(parsedBody.data);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, message: validation.message },
        { status: 400 },
      );
    }

    // Associate authenticated feedback strictly via verified server-side session; never trust client userId.
    const session = await getServerSession();
    const userId = session ? session.user.id : null;
    const ip = await getClientIp(request);

    if (userId) {
      const [userLimit, ipLimit] = await Promise.all([
        checkRateLimit('feedback:user', userId, AUTH_FEEDBACK_USER_LIMIT, GUEST_FEEDBACK_WINDOW_MS),
        checkRateLimit('feedback:ip', ip, AUTH_FEEDBACK_IP_LIMIT, GUEST_FEEDBACK_WINDOW_MS),
      ]);
      const blocked = !userLimit.allowed ? userLimit : !ipLimit.allowed ? ipLimit : null;
      if (blocked) {
        return NextResponse.json(
          {
            ok: false,
            code: 'RATE_LIMITED',
            message: 'You have submitted feedback recently. Please wait a few minutes before sending more.',
          },
          {
            status: 429,
            headers: { 'Retry-After': String(blocked.retryAfterSeconds) },
          },
        );
      }
    } else {
      const guestLimit = await checkRateLimit('feedback:ip', ip, GUEST_FEEDBACK_LIMIT, GUEST_FEEDBACK_WINDOW_MS);
      if (!guestLimit.allowed) {
        return NextResponse.json(
          {
            ok: false,
            code: 'RATE_LIMITED',
            message: 'You have submitted feedback recently. Please wait a few minutes before sending more.',
          },
          {
            status: 429,
            headers: { 'Retry-After': String(guestLimit.retryAfterSeconds) },
          },
        );
      }
    }

    const createdAt = new Date();
    const { feedback } = await getCollections();
    const insertResult = await feedback.insertOne({
      category: validation.data.category,
      lab: validation.data.lab,
      description: validation.data.description,
      userId,
      createdAt,
    });

    return NextResponse.json(
      {
        ok: true,
        feedback: {
          id: String(insertResult.insertedId),
          category: validation.data.category,
          lab: validation.data.lab,
          description: validation.data.description,
          createdAt: createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleAuthRouteError('feedback-submit', error);
  }
}

import { NextResponse } from 'next/server';
import { clearSessionCookie, destroyServerSession } from '@/lib/auth/session';

export async function POST() {
  await destroyServerSession();
  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookie(response);
  return response;
}

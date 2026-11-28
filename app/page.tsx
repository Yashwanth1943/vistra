import { redirect } from 'next/navigation';
import { getServerSessionResult } from '@/lib/auth/session';
import { VistraAppShell } from '@/components/VistraAppShell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const result = await getServerSessionResult();
  if (result.status === 'unavailable') {
    redirect(
      `/auth/error?message=${encodeURIComponent(
        'Authentication service is temporarily unavailable. Please try again shortly.',
      )}`,
    );
  }
  const currentUser =
    result.status === 'authenticated'
      ? {
          id: result.session.user.id,
          name: result.session.user.name,
          email: result.session.user.email,
          role: result.session.user.role,
        }
      : null;

  return <VistraAppShell currentUser={currentUser} />;
}

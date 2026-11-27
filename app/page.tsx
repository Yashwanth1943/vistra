import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { VistraAppShell } from '@/components/VistraAppShell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <VistraAppShell
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
    />
  );
}

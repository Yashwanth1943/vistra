import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    redirect('/');
  }

  return (
    <AuthShell
      title="Sign in to Vistra"
      subtitle="Enter your email address to receive a secure, single-use login link."
    >
      <LoginForm />
    </AuthShell>
  );
}

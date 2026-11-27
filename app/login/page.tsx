import { redirect } from 'next/navigation';
import { getServerSessionResult } from '@/lib/auth/session';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const result = await getServerSessionResult();
  if (result.status === 'authenticated') {
    redirect('/');
  }

  return (
    <AuthShell
      title="Sign in to Vistra"
      subtitle="Enter your email address to receive a secure, single-use login link."
    >
      {result.status === 'unavailable' ? (
        <div className="auth-alert auth-alert--error" role="alert">
          Authentication service is temporarily unavailable. Please try again shortly.
        </div>
      ) : null}
      <LoginForm />
    </AuthShell>
  );
}

import { redirect } from 'next/navigation';
import { getServerSessionResult } from '@/lib/auth/session';
import { AuthShell } from '@/components/AuthShell';
import { RegisterForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const result = await getServerSessionResult();
  if (result.status === 'authenticated') {
    redirect('/');
  }

  return (
    <AuthShell
      title="Create your Vistra account"
      subtitle="Start learning HTML and CSS visually. No passwords to remember."
    >
      {result.status === 'unavailable' ? (
        <div className="auth-alert auth-alert--error" role="alert">
          Authentication service is temporarily unavailable. Please try again shortly.
        </div>
      ) : null}
      <RegisterForm />
    </AuthShell>
  );
}

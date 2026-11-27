import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AuthShell } from '@/components/AuthShell';
import { RegisterForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const session = await getServerSession();
  if (session) {
    redirect('/');
  }

  return (
    <AuthShell
      title="Create your Vistra account"
      subtitle="Start learning HTML and CSS visually. No passwords to remember."
    >
      <RegisterForm />
    </AuthShell>
  );
}

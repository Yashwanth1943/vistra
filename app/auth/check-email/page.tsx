import Link from 'next/link';
import { MailCheck, ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; email?: string }>;
}) {
  const params = await searchParams;
  const isRegister = params.mode === 'register';
  const email = params.email?.trim();

  return (
    <AuthShell
      title={isRegister ? 'Account created' : 'Check your email'}
      subtitle={
        isRegister
          ? 'Your Vistra account is ready. We sent a welcome email to your inbox.'
          : 'If an account exists for this email address, a secure login link has been sent.'
      }
      footer={
        <div className="auth-switch">
          <span>{isRegister ? 'Ready to sign in?' : 'Need another link?'}</span>
          <Link href="/login" className="auth-link">
            <span>{isRegister ? 'Sign in with magic link' : 'Back to sign in'}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      }
    >
      <div className="auth-status-box">
        <div className="auth-status-icon auth-status-icon--success" aria-hidden="true">
          <MailCheck size={24} />
        </div>
        {email ? <p className="auth-status-email">{email}</p> : null}
        <p className="auth-status-copy">
          {isRegister
            ? 'Verify your email ownership by signing in with a magic link on the sign-in page.'
            : 'Open the email and click the Sign in to Vistra button. The link expires in 10 minutes and works once.'}
        </p>
        {isRegister ? (
          <Link href="/login" className="auth-submit auth-submit--link">
            <span>Continue to Sign In</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}

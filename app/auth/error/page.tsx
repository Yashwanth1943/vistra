import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const message =
    params.message?.trim() ||
    'We could not complete your authentication request. Please request a fresh magic link.';

  return (
    <AuthShell title="Authentication error" subtitle={message}>
      <div className="auth-status-box" role="alert">
        <div className="auth-status-icon auth-status-icon--error" aria-hidden="true">
          <AlertTriangle size={24} />
        </div>
        <Link href="/login" className="auth-submit auth-submit--link">
          <span>Return to Sign In</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </AuthShell>
  );
}

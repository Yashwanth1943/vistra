'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';

type VerifyState =
  | { status: 'verifying' }
  | { status: 'success' }
  | { status: 'error'; reason: string; message: string };

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<VerifyState>({ status: 'verifying' });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token.trim()) {
      setState({
        status: 'error',
        reason: 'missing',
        message: 'No verification token was found in this link.',
      });
      return;
    }

    (async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          reason?: string;
          message?: string;
        };

        if (!response.ok || !data.ok) {
          setState({
            status: 'error',
            reason: data.reason ?? 'invalid',
            message:
              data.message ||
              'This sign-in link is invalid or has expired. Please request a new one.',
          });
          return;
        }

        setState({ status: 'success' });
        router.replace('/');
        router.refresh();
      } catch {
        setState({
          status: 'error',
          reason: 'network',
          message: 'We could not verify your sign-in link due to a network error.',
        });
      }
    })();
  }, [router, token]);

  if (state.status === 'verifying') {
    return (
      <AuthShell
        title="Verifying your sign-in link"
        subtitle="Please wait while we validate your single-use magic link."
      >
        <div className="auth-status-box" role="status" aria-live="polite">
          <div className="auth-status-icon auth-status-icon--loading" aria-hidden="true">
            <Loader2 size={24} className="auth-spin" />
          </div>
          <p className="auth-status-copy">Checking token security and starting your session…</p>
        </div>
      </AuthShell>
    );
  }

  if (state.status === 'success') {
    return (
      <AuthShell
        title="Signed in to Vistra"
        subtitle="Your email has been verified. Redirecting to your learning workspace…"
      >
        <div className="auth-status-box" role="status" aria-live="polite">
          <div className="auth-status-icon auth-status-icon--success" aria-hidden="true">
            <CheckCircle2 size={24} />
          </div>
          <Link href="/" className="auth-submit auth-submit--link">
            <span>Open Vistra Workspace</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  const isExpiredOrUsed = state.reason === 'expired' || state.reason === 'used';

  return (
    <AuthShell
      title={isExpiredOrUsed ? 'Sign-in link unavailable' : 'Invalid sign-in link'}
      subtitle={state.message}
    >
      <div className="auth-status-box" role="alert">
        <div className="auth-status-icon auth-status-icon--error" aria-hidden="true">
          <AlertTriangle size={24} />
        </div>
        <p className="auth-status-copy">
          Magic links are single-use and expire after 10 minutes for your security.
        </p>
        <Link href="/login" className="auth-submit auth-submit--link">
          <span>Request a New Login Link</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Verifying your sign-in link" subtitle="Loading verification…">
          <div className="auth-status-box" role="status">
            <div className="auth-status-icon auth-status-icon--loading" aria-hidden="true">
              <Loader2 size={24} className="auth-spin" />
            </div>
          </div>
        </AuthShell>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

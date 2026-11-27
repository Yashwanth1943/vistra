'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Sparkles, UserPlus } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.message || 'Unable to send login link. Please try again.');
        return;
      }

      router.push(`/auth/check-email?mode=login&email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError('Network error while requesting your login link. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <label className="auth-field">
        <span>Email address</span>
        <div className="auth-input-wrap">
          <Mail size={16} aria-hidden="true" />
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={submitting}
          />
        </div>
      </label>

      <button type="submit" className="auth-submit" disabled={submitting}>
        <Sparkles size={16} aria-hidden="true" />
        <span>{submitting ? 'Sending link…' : 'Send Login Link'}</span>
        <ArrowRight size={15} aria-hidden="true" />
      </button>

      <p className="auth-hint">
        We will send a single-use magic link that expires in 10 minutes. No password required.
      </p>

      <div className="auth-switch">
        <span>New to Vistra?</span>
        <Link href="/register" className="auth-link">
          <UserPlus size={14} aria-hidden="true" />
          <span>Create an account</span>
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setExistingAccount(false);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        if (data.code === 'ACCOUNT_EXISTS') {
          setExistingAccount(true);
        }
        setError(data.message || 'Could not create your account. Please try again.');
        return;
      }

      router.push(`/auth/check-email?mode=register&email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError('Network error while creating your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="auth-alert auth-alert--error" role="alert">
          <span>{error}</span>
          {existingAccount ? (
            <Link href="/login" className="auth-alert-link">
              Sign in with magic link
            </Link>
          ) : null}
        </div>
      ) : null}

      <label className="auth-field">
        <span>Full name</span>
        <input
          type="text"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada Lovelace"
          disabled={submitting}
        />
      </label>

      <label className="auth-field">
        <span>Email address</span>
        <div className="auth-input-wrap">
          <Mail size={16} aria-hidden="true" />
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={submitting}
          />
        </div>
      </label>

      <button type="submit" className="auth-submit" disabled={submitting}>
        <span>{submitting ? 'Creating account…' : 'Create Account'}</span>
        <ArrowRight size={15} aria-hidden="true" />
      </button>

      <div className="auth-switch">
        <span>Already have a Vistra account?</span>
        <Link href="/login" className="auth-link">
          <span>Sign in</span>
        </Link>
      </div>
    </form>
  );
}

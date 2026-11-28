'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Sparkles, UserPlus } from 'lucide-react';

function GoogleGIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function ContinueWithGoogleButton() {
  return (
    <a href="/api/auth/google" className="auth-google-btn">
      <GoogleGIcon />
      <span>Continue with Google</span>
    </a>
  );
}

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
    <div className="auth-methods">
      <ContinueWithGoogleButton />

      <div className="auth-divider" role="separator" aria-label="or">
        <span>or continue with email</span>
      </div>

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
            placeholder="you@gmail.com"
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
      <div className="auth-guest-return">
        <Link href="/" className="auth-link">
          Continue learning as guest →
        </Link>
      </div>
      </form>
    </div>
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
    <div className="auth-methods">
      <ContinueWithGoogleButton />

      <div className="auth-divider" role="separator" aria-label="or">
        <span>or register with Gmail</span>
      </div>

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
      <div className="auth-guest-return">
        <Link href="/" className="auth-link">
          Continue learning as guest →
        </Link>
      </div>
      </form>
    </div>
  );
}

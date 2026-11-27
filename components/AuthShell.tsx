import Link from 'next/link';
import { VistraLogo } from './VistraLogo';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Link href="/login" aria-label="Vistra" className="auth-brand-link">
            <VistraLogo variant="full" size={34} decorative />
          </Link>
          <p className="auth-tagline">See beyond the code.</p>
        </div>
        <div className="auth-header">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
      <p className="auth-legal">Passwordless authentication via single-use email magic links</p>
    </div>
  );
}

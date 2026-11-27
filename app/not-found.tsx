import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';

export default function NotFoundPage() {
  return (
    <AuthShell
      title="Page not found"
      subtitle="The page you requested could not be found in Vistra."
    >
      <div className="auth-status-box">
        <Link href="/" className="auth-submit auth-submit--link">
          <span>Return to Vistra</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </AuthShell>
  );
}

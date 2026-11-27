'use client';

import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Vistra route error:', error);
  }, [error]);

  return (
    <main className="app-error" role="alert">
      <span className="section-kicker">RECOVERABLE APP ERROR</span>
      <h1>This page could not finish loading.</h1>
      <p>Your work in this session is still in memory. Try the page again.</p>
      <button type="button" className="primary-button" onClick={reset}>Try again</button>
    </main>
  );
}

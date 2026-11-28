'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookmarkCheck, X } from 'lucide-react';
import {
  computeRemainingDelayMs,
  GUEST_AUTH_CHANNEL,
  GUEST_PROMPT_DELAY_MS,
  GUEST_PROMPT_STORAGE_KEY,
  readGuestPromptState,
  writeGuestPromptState,
} from '@/lib/guest-prompt';

export { GUEST_AUTH_CHANNEL };

interface GuestLoginPromptProps {
  delayMs?: number;
}

export function GuestLoginPrompt({ delayMs = GUEST_PROMPT_DELAY_MS }: GuestLoginPromptProps) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const skipBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const dismissPrompt = useCallback(() => {
    setOpen(false);
    const current = readGuestPromptState(window.sessionStorage);
    writeGuestPromptState(window.sessionStorage, {
      firstVisitAt: current.firstVisitAt,
      dismissed: true,
    });
    if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
      window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const storage = window.sessionStorage;
    const existingRaw = storage.getItem(GUEST_PROMPT_STORAGE_KEY);
    const state = readGuestPromptState(storage);
    if (!existingRaw) {
      writeGuestPromptState(storage, state);
    }

    const remaining = computeRemainingDelayMs(state, delayMs);
    if (remaining === null) {
      return;
    }

    let timerId: number | undefined;
    const openDialog = () => {
      const latest = readGuestPromptState(storage);
      if (latest.dismissed) return;
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };

    if (remaining === 0) {
      openDialog();
    } else {
      timerId = window.setTimeout(openDialog, remaining);
    }

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(GUEST_AUTH_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'authenticated') {
          if (timerId !== undefined) {
            window.clearTimeout(timerId);
          }
          setOpen(false);
        }
      };
    }

    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      channel?.close();
    };
  }, [delayMs]);

  useEffect(() => {
    if (!open) return;
    const rafId = window.requestAnimationFrame(() => {
      skipBtnRef.current?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissPrompt();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, dismissPrompt]);

  if (!open) {
    return null;
  }

  const handleTrapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !cardRef.current) return;
    const focusables = Array.from(
      cardRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop guest-prompt-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-login-prompt-title"
      aria-describedby="guest-login-prompt-desc"
    >
      <div
        ref={cardRef}
        onKeyDown={handleTrapTab}
        className="modal-card guest-prompt-card"
      >
        <div className="modal-head">
          <div className="guest-prompt-title-wrap">
            <span className="guest-prompt-icon" aria-hidden="true">
              <BookmarkCheck size={18} />
            </span>
            <h2 id="guest-login-prompt-title">Want to save your learning progress?</h2>
          </div>
          <button
            type="button"
            className="ws-icon-btn"
            onClick={dismissPrompt}
            aria-label="Close sign in reminder"
          >
            <X size={16} />
          </button>
        </div>

        <p id="guest-login-prompt-desc" className="guest-prompt-desc">
          Sign in to save your learning history, track your progress, and continue where you left off on your next visit.
        </p>

        <div className="guest-prompt-actions">
          <Link href="/login" className="primary-button guest-prompt-primary">
            <span>Sign in / Create account</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button
            ref={skipBtnRef}
            type="button"
            className="secondary-button guest-prompt-skip"
            onClick={dismissPrompt}
          >
            Skip for now — Continue learning
          </button>
        </div>

        <p className="guest-prompt-note">
          You can continue learning without an account. No login required.
        </p>
      </div>
    </div>
  );
}

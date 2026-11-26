'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, MessageSquare, X } from 'lucide-react';
import { submitFeedback, type FeedbackCategory } from '../app/student-store';

const CATEGORIES: FeedbackCategory[] = [
  'Confusing behavior',
  'Bug report',
  'Feature idea',
  'Content feedback',
];

export function FeedbackModal({
  activeLab,
  onClose,
}: {
  activeLab: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<FeedbackCategory>('Confusing behavior');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTrapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !cardRef.current) return;
    const focusables = Array.from(
      cardRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitFeedback(category, activeLab, description);
    setSubmitted(true);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
      <div ref={cardRef} className="modal-card" onKeyDown={handleTrapTab}>
        <div className="modal-head">
          <h2 id="feedback-modal-title">
            <MessageSquare size={16} /> Lab Feedback
          </h2>
          <button ref={closeBtnRef} type="button" className="ws-icon-btn" onClick={onClose} aria-label="Close feedback dialog">
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="modal-success" role="status">
            <Check size={20} />
            <div>
              <strong>Feedback recorded for {activeLab}.</strong>
              <p>Thank you! Your note is saved locally in your Student Workspace.</p>
            </div>
            <button type="button" className="primary-button" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="modal-context">
              Active experiment: <code>{activeLab}</code>
            </div>

            <label className="viz-control">
              <div className="viz-control-head">
                <span>Feedback category</span>
              </div>
              <select
                aria-label="Feedback category"
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="viz-control">
              <div className="viz-control-head">
                <span>Description (optional)</span>
              </div>
              <textarea
                aria-label="Feedback description"
                rows={3}
                placeholder="What felt confusing, broken, or helpful in this lab?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="reset-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary-button">
                Submit feedback
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

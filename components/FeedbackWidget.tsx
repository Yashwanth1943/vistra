'use client';

import { useState } from 'react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitFeedback(category, activeLab, description);
    setSubmitted(true);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
      <div className="modal-card">
        <div className="modal-head">
          <h2 id="feedback-modal-title">
            <MessageSquare size={16} /> Lab Feedback
          </h2>
          <button type="button" className="ws-icon-btn" onClick={onClose} aria-label="Close feedback dialog">
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

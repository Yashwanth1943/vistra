'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clock,
  FolderKanban,
  MessageSquare,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  clearPlaygroundDraft,
  clearRecentLabs,
  deleteBuilderProject,
  readBuilderProjects,
  readDebugExperiments,
  readFeedback,
  readPlaygroundDraft,
  readRecentLabs,
  type FeedbackEntry,
  type RecentLabEntry,
  type StoredBuilderProject,
  type StoredDebugExperiment,
} from '../app/student-store';

type ConceptRef = { id: string; title: string; group: string };

export function StudentWorkspace({
  initialSection = 'saved',
  recentConcepts,
  favoriteConcepts,
  onNavigate,
  onSelectConcept,
  onOpenFeedback,
}: {
  initialSection?: 'saved' | 'recent';
  recentConcepts: ConceptRef[];
  favoriteConcepts: ConceptRef[];
  onNavigate: (tab: string) => void;
  onSelectConcept: (id: string) => void;
  onOpenFeedback: () => void;
}) {
  const [recentLabs, setRecentLabs] = useState<RecentLabEntry[]>(() => readRecentLabs());
  const [projects, setProjects] = useState<StoredBuilderProject[]>(() => readBuilderProjects());
  const [debugExps, setDebugExps] = useState<StoredDebugExperiment[]>(() => readDebugExperiments());
  const [draft, setDraft] = useState<{ html: string; css: string } | null>(() => readPlaygroundDraft());
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>(() => readFeedback());

  useEffect(() => {
    setRecentLabs(readRecentLabs());
    setProjects(readBuilderProjects());
    setDebugExps(readDebugExperiments());
    setDraft(readPlaygroundDraft());
    setFeedbackList(readFeedback());
  }, [initialSection]);

  const savedExperimentsSection = (
    <div className="ws-grid">
      {/* Active Code Playground Draft & Saved Experiments */}
      <div className="ws-card">
        <div className="dbg-bar-sub">SAVED EXPERIMENTS &amp; DRAFTS</div>
        <div className="ws-list">
          {draft ? (
            <div className="ws-row">
              <button type="button" className="ws-row-main" onClick={() => onNavigate('Playground')}>
                <strong>Active Code Playground Draft</strong>
                <small>{draft.html.length} chars HTML · {draft.css.length} chars CSS</small>
              </button>
              <button
                type="button"
                className="ws-icon-btn"
                aria-label="Clear playground draft"
                onClick={() => {
                  clearPlaygroundDraft();
                  setDraft(null);
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <div className="ws-empty-box">
              <p className="ws-empty">No active Code Playground draft in this session.</p>
              <button type="button" className="reset-button" onClick={() => onNavigate('Playground')}>
                Open Code Playground <ArrowRight size={13} />
              </button>
            </div>
          )}

          {projects.map((proj) => (
            <div key={proj.id} className="ws-row">
              <button
                type="button"
                className="ws-row-main"
                onClick={() => onNavigate('Playground')}
              >
                <strong>{proj.name}</strong>
                <small>
                  {Array.isArray(proj.blocks) ? proj.blocks.length : 0} blocks · saved {proj.savedAt}
                </small>
              </button>
              <button
                type="button"
                className="ws-icon-btn"
                aria-label={`Delete project ${proj.name}`}
                onClick={() => setProjects(deleteBuilderProject(proj.id))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {debugExps.map((exp) => (
            <button
              key={exp.scenarioId}
              type="button"
              className="ws-row-btn"
              onClick={() => onNavigate('Visual Debugger')}
            >
              <div>
                <strong>Saved CSS Experiment: {exp.scenarioId}</strong>
                <small>Saved {new Date(exp.savedAt).toLocaleTimeString()}</small>
              </div>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Bookmarked Concepts */}
      <div className="ws-card">
        <div className="dbg-bar-sub">BOOKMARKED CONCEPTS ({favoriteConcepts.length})</div>
        {favoriteConcepts.length > 0 ? (
          <div className="ws-concepts-strip">
            {favoriteConcepts.map((c) => (
              <button
                key={`fav-${c.id}`}
                type="button"
                className="viz-preset-btn active"
                onClick={() => onSelectConcept(c.id)}
              >
                {c.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="ws-empty-box">
            <p className="ws-empty">No bookmarked concepts yet. Star any topic in Concept Reference.</p>
            <button type="button" className="reset-button" onClick={() => onNavigate('Learn')}>
              Open Concept Reference <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const recentActivitySection = (
    <div className="ws-grid">
      {/* Recently Visited Labs */}
      <div className="ws-card">
        <div className="dbg-bar-sub">RECENTLY VISITED LABS</div>
        {recentLabs.length > 0 ? (
          <div className="ws-list">
            {recentLabs.map((item) => (
              <button
                key={item.tab}
                type="button"
                className="ws-row-btn"
                onClick={() => onNavigate(item.tab)}
              >
                <div>
                  <strong>{item.tab}</strong>
                  <small>
                    <Clock size={11} /> {item.visitedAt}
                  </small>
                </div>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        ) : (
          <p className="ws-empty">Open any lab or playground and your recent sessions will appear here.</p>
        )}
      </div>

      {/* Recent Concepts & Feedback Log */}
      <div className="ws-card">
        <div className="dbg-bar-sub">RECENT CONCEPTS &amp; FEEDBACK</div>
        {recentConcepts.length > 0 && (
          <div className="ws-concepts-strip" style={{ marginBottom: 12 }}>
            {recentConcepts.map((c) => (
              <button
                key={`rec-${c.id}`}
                type="button"
                className="viz-preset-btn"
                onClick={() => onSelectConcept(c.id)}
              >
                {c.title}
              </button>
            ))}
          </div>
        )}
        {feedbackList.length > 0 ? (
          <div className="ws-list">
            {feedbackList.slice(0, 4).map((fb) => (
              <div key={fb.id} className="ws-fb-item">
                <div>
                  <strong>{fb.category}</strong>
                  <span>{fb.lab}</span>
                </div>
                {fb.description && <p>{fb.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="ws-empty">No feedback submitted yet. Use Send feedback in any lab.</p>
        )}
      </div>
    </div>
  );

  return (
    <section className="lab-page enhanced-lab ws-page">
      <div className="viz-header">
        <div>
          <div className="eyebrow-line">
            <FolderKanban size={13} /> MY WORKSPACE
          </div>
          <h1>{initialSection === 'recent' ? 'Recent Activity' : 'Saved Experiments'}</h1>
          <p>
            {initialSection === 'recent'
              ? 'Jump back into labs you visited recently, recent concepts, and contextual feedback.'
              : 'Resume your active Code Playground draft, saved experiments, and bookmarked concepts.'}
          </p>
        </div>
        <div className="viz-header-actions">
          <button type="button" className="reset-button" onClick={onOpenFeedback}>
            <MessageSquare size={14} /> Send feedback
          </button>
          {initialSection === 'recent' && recentLabs.length > 0 && (
            <button
              type="button"
              className="reset-button"
              onClick={() => {
                clearRecentLabs();
                setRecentLabs([]);
              }}
            >
              <RotateCcw size={14} /> Clear history
            </button>
          )}
        </div>
      </div>

      {initialSection === 'recent' ? (
        <>
          {recentActivitySection}
          {savedExperimentsSection}
        </>
      ) : (
        <>
          {savedExperimentsSection}
          {recentActivitySection}
        </>
      )}
    </section>
  );
}

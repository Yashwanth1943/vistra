/**
 * Privacy-conscious local student workspace and contextual feedback store.
 * Reuses existing localStorage/sessionStorage keys without collecting personal data.
 */

export type RecentLabEntry = {
  tab: string;
  visitedAt: string;
};

export type FeedbackCategory =
  | 'Confusing behavior'
  | 'Bug report'
  | 'Feature idea'
  | 'Content feedback';

export type FeedbackEntry = {
  id: string;
  category: FeedbackCategory;
  lab: string;
  description: string;
  createdAt: string;
};

export type StoredBuilderProject = {
  id: string;
  name: string;
  blocks: unknown[];
  savedAt: string;
};

export type StoredDebugExperiment = {
  scenarioId: string;
  css: string;
  savedAt: string;
};

const ANALYTICS_KEY = 'webcraft:analytics';
const FEEDBACK_KEY = 'webcraft:feedback';
const BUILDER_PROJECTS_KEY = 'webcraft:builder-projects';
const DEBUG_EXPERIMENTS_KEY = 'webcraft:debug-experiments';
const PLAYGROUND_DRAFT_KEY = 'webcraft:playground-draft';

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readRecentLabs(): RecentLabEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = safeJsonParse<{ recentLabs?: RecentLabEntry[] }>(
      localStorage.getItem(ANALYTICS_KEY),
      {}
    );
    return Array.isArray(parsed.recentLabs) ? parsed.recentLabs : [];
  } catch {
    return [];
  }
}

function writeRecentLabs(recentLabs: RecentLabEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify({ recentLabs }));
  } catch {
    /* Ignore storage quota errors */
  }
}

export function trackLabVisit(tab: string) {
  const cur = readRecentLabs();
  const nextRecent = [
    { tab, visitedAt: new Date().toLocaleTimeString() },
    ...cur.filter((item) => item.tab !== tab),
  ].slice(0, 8);
  writeRecentLabs(nextRecent);
}

export function clearRecentLabs() {
  writeRecentLabs([]);
}

export function readFeedback(): FeedbackEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = safeJsonParse<FeedbackEntry[]>(localStorage.getItem(FEEDBACK_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function submitFeedback(
  category: FeedbackCategory,
  lab: string,
  description: string
): FeedbackEntry {
  const entry: FeedbackEntry = {
    id: `fb-${Date.now().toString(36)}`,
    category,
    lab,
    description: description.trim(),
    createdAt: new Date().toLocaleTimeString(),
  };
  const next = [entry, ...readFeedback()].slice(0, 30);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
    } catch {
      /* Ignore storage quota errors */
    }
  }
  return entry;
}

export function readBuilderProjects(): StoredBuilderProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = safeJsonParse<StoredBuilderProject[]>(
      localStorage.getItem(BUILDER_PROJECTS_KEY),
      []
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deleteBuilderProject(id: string): StoredBuilderProject[] {
  const next = readBuilderProjects().filter((p) => p.id !== id);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(BUILDER_PROJECTS_KEY, JSON.stringify(next));
    } catch {
      /* Ignore storage error */
    }
  }
  return next;
}

export function readDebugExperiments(): StoredDebugExperiment[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = safeJsonParse<Record<string, StoredDebugExperiment>>(
      localStorage.getItem(DEBUG_EXPERIMENTS_KEY),
      {}
    );
    return Object.values(parsed).filter((e) => Boolean(e && e.scenarioId));
  } catch {
    return [];
  }
}

export function readPlaygroundDraft(): { html: string; css: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = safeJsonParse<{ html?: string; css?: string } | null>(
      sessionStorage.getItem(PLAYGROUND_DRAFT_KEY),
      null
    );
    if (parsed && typeof parsed.html === 'string' && typeof parsed.css === 'string') {
      return { html: parsed.html, css: parsed.css };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPlaygroundDraft() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PLAYGROUND_DRAFT_KEY);
  } catch {
    /* Ignore storage error */
  }
}

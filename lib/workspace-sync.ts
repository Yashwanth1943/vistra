export type WorkspaceSyncStatus = 'loading' | 'saved' | 'saving' | 'error';
export type WorkspaceSyncErrorSource = 'load' | 'save' | null;

export interface WorkspaceHydrationSuccess {
  ok: true;
  favorites: string[];
  recent: string[];
}

export interface WorkspaceHydrationFailure {
  ok: false;
  status: number | null;
  retryable: boolean;
}

export type WorkspaceHydrationResult =
  | WorkspaceHydrationSuccess
  | WorkspaceHydrationFailure;

export async function fetchWorkspaceProgress(
  fetchImpl: typeof fetch,
  normalizeIds: (values: unknown) => string[],
): Promise<WorkspaceHydrationResult> {
  try {
    const res = await fetchImpl('/api/workspace', { cache: 'no-store' });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        retryable: res.status >= 500 || res.status === 429,
      };
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return { ok: false, status: res.status, retryable: false };
    }

    const record = data as {
      ok?: unknown;
      workspace?: { progress?: { favorites?: unknown; recent?: unknown } | null } | null;
    } | null;

    if (
      !record ||
      record.ok !== true ||
      !record.workspace ||
      !record.workspace.progress ||
      typeof record.workspace.progress !== 'object'
    ) {
      return { ok: false, status: res.status, retryable: false };
    }

    const { progress } = record.workspace;
    return {
      ok: true,
      favorites: Array.isArray(progress.favorites) ? normalizeIds(progress.favorites) : [],
      recent: Array.isArray(progress.recent) ? normalizeIds(progress.recent).slice(0, 6) : [],
    };
  } catch {
    return { ok: false, status: null, retryable: true };
  }
}

export function shouldPersistWorkspaceProgress(params: {
  authenticated: boolean;
  hydrated: boolean;
  revision: number;
  savedRevision: number;
}): boolean {
  return params.authenticated && params.hydrated && params.revision > params.savedRevision;
}

export function resolvePutCompletion(params: {
  ok: boolean;
  targetRevision: number;
  latestRevision: number;
  currentSavedRevision: number;
}): {
  nextSavedRevision: number;
  nextStatus: WorkspaceSyncStatus;
  nextErrorSource: WorkspaceSyncErrorSource;
} {
  if (!params.ok) {
    return {
      nextSavedRevision: params.currentSavedRevision,
      nextStatus: 'error',
      nextErrorSource: 'save',
    };
  }

  const nextSavedRevision = Math.max(params.currentSavedRevision, params.targetRevision);
  if (params.latestRevision > nextSavedRevision) {
    // A newer local change occurred while this PUT was in flight; stay in 'saving' until it completes.
    return {
      nextSavedRevision,
      nextStatus: 'saving',
      nextErrorSource: null,
    };
  }

  return {
    nextSavedRevision,
    nextStatus: 'saved',
    nextErrorSource: null,
  };
}

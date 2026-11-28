export const GUEST_PROMPT_STORAGE_KEY = 'vistra:guest-prompt';
export const GUEST_PROMPT_DELAY_MS = 10 * 60 * 1000;
export const GUEST_AUTH_CHANNEL = 'vistra-guest-auth';

export interface GuestPromptState {
  firstVisitAt: number;
  dismissed: boolean;
}

export function readGuestPromptState(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  now = Date.now(),
): GuestPromptState {
  if (!storage) {
    return { firstVisitAt: now, dismissed: false };
  }
  try {
    const raw = storage.getItem(GUEST_PROMPT_STORAGE_KEY);
    if (!raw) {
      return { firstVisitAt: now, dismissed: false };
    }
    const parsed = JSON.parse(raw) as Partial<GuestPromptState>;
    const firstVisitAt =
      typeof parsed.firstVisitAt === 'number' && Number.isFinite(parsed.firstVisitAt) && parsed.firstVisitAt > 0
        ? parsed.firstVisitAt
        : now;
    const dismissed = parsed.dismissed === true;
    return { firstVisitAt, dismissed };
  } catch {
    return { firstVisitAt: now, dismissed: false };
  }
}

export function writeGuestPromptState(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  state: GuestPromptState,
): void {
  if (!storage) return;
  try {
    storage.setItem(GUEST_PROMPT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota/private mode errors gracefully.
  }
}

export function computeRemainingDelayMs(
  state: GuestPromptState,
  delayMs = GUEST_PROMPT_DELAY_MS,
  now = Date.now(),
): number | null {
  if (state.dismissed) {
    return null;
  }
  const elapsed = Math.max(0, now - state.firstVisitAt);
  return Math.max(0, delayMs - elapsed);
}

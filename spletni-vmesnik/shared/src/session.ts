import type { SessionState } from "./types";

const SESSION_KEY = "ita.smartparking.session";

export const EMPTY_SESSION: SessionState = {
  token: null,
  user: null,
};

export function loadSession(): SessionState {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return EMPTY_SESSION;
  }

  try {
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed || typeof parsed !== "object") {
      return EMPTY_SESSION;
    }
    return {
      token: parsed.token || null,
      user: parsed.user || null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

export function saveSession(next: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

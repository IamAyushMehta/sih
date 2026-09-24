export type Role = 'ADMIN' | 'PLANNER' | 'LOGISTICS' | 'MEDICAL' | 'EMERGENCY';

export type AuthState = {
  token: string;
  user: { id: string; username: string; role: string };
};

const KEY = 'sih26062_auth';

export function loadAuth(): AuthState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function saveAuth(state: AuthState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}

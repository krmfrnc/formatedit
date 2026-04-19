'use client';

export interface ClientAuthState {
  token: string | null;
  isAuthenticated: boolean;
}

export function useAuth(): ClientAuthState {
  try {
    if (typeof document === 'undefined') {
      return { token: null, isAuthenticated: false };
    }
    const match = document.cookie.match(/(?:^|;\s*)auth-token=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    return { token, isAuthenticated: Boolean(token) };
  } catch {
    return { token: null, isAuthenticated: false };
  }
}

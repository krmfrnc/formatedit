'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const ACCESS_COOKIE = 'auth-token';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user?: AuthUser;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readAccessCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)auth-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function writeAccessCookie(token: string): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${15 * 60}; SameSite=Lax${secure}`;
}

function clearAccessCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    setToken(readAccessCookie());
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = (async () => {
      try {
        const res = await fetch(`${apiUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as AuthSession;
        writeAccessCookie(data.accessToken);
        setToken(data.accessToken);
        if (data.user) setUser(data.user);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  }, []);

  const authFetch = useCallback(
    async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
      const build = (bearer: string | null): RequestInit => ({
        ...init,
        credentials: 'include',
        headers: {
          ...(init.headers ?? {}),
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        },
      });

      const current = token ?? readAccessCookie();
      let response = await fetch(input, build(current));
      if (response.status !== 401) return response;

      const refreshed = await refresh();
      if (!refreshed) return response;
      response = await fetch(input, build(refreshed));
      return response;
    },
    [token, refresh],
  );

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('login_failed');
    const data = (await res.json()) as AuthSession;
    writeAccessCookie(data.accessToken);
    setToken(data.accessToken);
    if (data.user) setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      /* ignore */
    }
    clearAccessCookie();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
      authFetch,
    }),
    [token, user, login, logout, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      token: null,
      user: null,
      isAuthenticated: false,
      login: async () => {
        throw new Error('AuthProvider is not mounted');
      },
      logout: async () => {},
      authFetch: (input, init) => fetch(input, init),
    };
  }
  return ctx;
}

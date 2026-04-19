'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearTokenCookie, getTokenCookie, setTokenCookie } from './cookie';

interface AuthState {
  token: string | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = getTokenCookie();
    if (storedToken) {
      setTokenState(storedToken);
    }
    setLoading(false);
  }, []);

  const login = (newToken: string) => {
    setTokenCookie(newToken);
    setTokenState(newToken);
  };

  const logout = () => {
    clearTokenCookie();
    setTokenState(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

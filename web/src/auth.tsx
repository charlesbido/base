import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api/client';
import type { SessionView, UserSummary } from './api/types';

interface AuthContextValue {
  /** undefined while the initial /auth/me check is in flight; null when signed out. */
  user: UserSummary | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null | undefined>(undefined);

  useEffect(() => {
    api
      .get<UserSummary>('/auth/me')
      .then(setUser)
      // 401 = signed out; a network error also lands on the sign-in screen, which shows it.
      .catch(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.post<SessionView>('/auth/login', { email, password });
    setUser(session.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const session = await api.post<SessionView>('/auth/register', { name, email, password });
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in user; only call inside routes guarded by <RequireAuth>. */
export function useMe(): UserSummary {
  const { user } = useAuth();
  if (!user) throw new Error('useMe called while signed out');
  return user;
}

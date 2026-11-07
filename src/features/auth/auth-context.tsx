import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { api, setApiAccessToken, setUnauthorizedHandler, usesBrowserSession } from '@/services/api';
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  storeAccessToken,
  storeLoginIdentifier,
} from '@/services/session-storage';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/models';
import { unregisterCurrentPushToken } from '@/services/notifications';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionActiveRef = useRef(false);
  const logoutPromiseRef = useRef<Promise<void> | null>(null);

  const clearSession = useCallback(async () => {
    if (!sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    setApiAccessToken(null);
    setToken(null);
    setUser(null);
    await clearStoredAccessToken().catch(() => undefined);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clearSession());
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = await getStoredAccessToken();
      if (!usesBrowserSession && !storedToken) return;
      sessionActiveRef.current = true;
      setApiAccessToken(storedToken);
      try {
        const response = await api.get<ApiResponse<User>>('/auth/me');
        setToken(storedToken);
        setUser(response.data.data);
      } catch {
        await clearSession();
      }
    };

    void restoreSession().finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post<ApiResponse<{ token?: string; user: User }>>('/auth/login', { username, password });
    const nextToken = response.data.data.token ?? null;
    if (!usesBrowserSession) {
      if (!nextToken) throw new Error('Máy chủ không trả về token đăng nhập cho ứng dụng di động.');
      await storeAccessToken(nextToken);
    }
    await storeLoginIdentifier(username.trim()).catch(() => undefined);
    sessionActiveRef.current = true;
    setApiAccessToken(nextToken);
    setToken(nextToken);
    setUser(response.data.data.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    setUser(response.data.data);
  }, []);

  const logout = useCallback(async () => {
    if (logoutPromiseRef.current) return logoutPromiseRef.current;

    const logoutPromise = (async () => {
      try {
        await unregisterCurrentPushToken().catch(() => undefined);
        await api.post('/auth/logout').catch(() => undefined);
      } finally {
        await clearSession();
      }
    })();

    logoutPromiseRef.current = logoutPromise;
    try {
      await logoutPromise;
    } finally {
      if (logoutPromiseRef.current === logoutPromise) logoutPromiseRef.current = null;
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshUser,
      can: permission => Boolean(user?.permissions?.includes(permission)),
    }),
    [loading, login, logout, refreshUser, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được sử dụng trong AuthProvider');
  return value;
}

import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

  const clearSession = useCallback(async () => {
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
    setApiAccessToken(nextToken);
    setToken(nextToken);
    setUser(response.data.data.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    setUser(response.data.data);
  }, []);

  const logout = useCallback(async () => {
    await unregisterCurrentPushToken().catch(() => undefined);
    await api.post('/auth/logout').catch(() => undefined);
    await clearSession();
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

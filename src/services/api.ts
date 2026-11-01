import { create, isAxiosError, type AxiosError } from 'axios';
import { Platform } from 'react-native';

import type { ApiErrorBody } from '@/types/api';

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://bhl.io.vn/api/v1';
export const usesBrowserSession = Platform.OS === 'web';

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const api = create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  withCredentials: usesBrowserSession,
  headers: {
    'Content-Type': 'application/json',
    'X-ERP-Client': 'mobile',
  },
});

api.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401) unauthorizedHandler?.();
    return Promise.reject(error);
  },
);

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function hasProtectedApiSession(token: string | null | undefined) {
  return usesBrowserSession || Boolean(token);
}

export function getProtectedApiHeaders(token: string | null | undefined) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getApiErrorMessage(error: unknown) {
  if (isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng.';
    const fieldError = error.response.data?.errors
      ? Object.values(error.response.data.errors).flat().find(Boolean)
      : undefined;
    return fieldError || error.response.data?.message || 'Yêu cầu không thành công.';
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
}

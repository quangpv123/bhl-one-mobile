import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { api, apiBaseUrl } from '@/services/api';

function safeFileName(value: string) {
  const normalized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
  return normalized || `bhl-one-${Date.now()}`;
}

export async function shareProtectedApiFile({
  path,
  token,
  fileName,
  mimeType,
  dialogTitle,
}: {
  path: string;
  token: string | null;
  fileName: string;
  mimeType: string;
  dialogTitle?: string;
}) {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  if (Platform.OS === 'web') {
    const response = await api.get<Blob>(path, { responseType: 'blob' });
    const blob = response.data.type ? response.data : new Blob([response.data], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = safeFileName(fileName);
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return;
  }
  if (!token) throw new Error('Phiên đăng nhập không có token để tải file.');
  const destination = new File(Paths.cache, `${Date.now()}-${safeFileName(fileName)}`);
  const downloaded = await File.downloadFileAsync(url, destination, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Thiết bị không hỗ trợ mở hoặc chia sẻ file này.');
  }
  await Sharing.shareAsync(downloaded.uri, { mimeType, dialogTitle });
}

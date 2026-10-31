import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiBaseUrl } from '@/services/api';

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
  token: string;
  fileName: string;
  mimeType: string;
  dialogTitle?: string;
}) {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
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

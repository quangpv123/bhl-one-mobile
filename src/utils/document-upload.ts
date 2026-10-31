import * as DocumentPicker from 'expo-document-picker';

const spreadsheetTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
];

export async function pickSpreadsheet() {
  const result = await DocumentPicker.getDocumentAsync({
    type: spreadsheetTypes,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets.length) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 20 * 1024 * 1024) throw new Error('Tệp import không được vượt quá 20 MB.');
  if (!/\.(xlsx|xls)$/i.test(asset.name)) throw new Error('Chỉ hỗ trợ tệp Excel .xlsx hoặc .xls.');
  return asset;
}

export function spreadsheetFormData(asset: DocumentPicker.DocumentPickerAsset) {
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.name || 'import.xlsx',
    type: asset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as Blob);
  return formData;
}

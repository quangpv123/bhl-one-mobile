import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AppButton, Card, ErrorState, InfoRow, LoadingBlock, StatusBadge } from '@/components/ui';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { LicensePlateHealth } from '@/types/business';

interface RecognitionResult {
  plate: string | null;
  formattedPlate: string | null;
  detectorConfidence: number;
  ocrConfidence: number;
  plateImage: { mimeType: string; base64: string; width: number; height: number } | null;
  characters: { value: string; confidence: number }[];
  processingMs: number;
}

export function LicensePlateAiScreen() {
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset>();
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState<RecognitionResult>();
  const health = useQuery({
    queryKey: ['license-plate-health-mobile'],
    queryFn: async () => (await api.get<LicensePlateHealth>('/tools/license-plate-ai/health', { timeout: 20_000 })).data,
  });

  const chooseImage = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cần quyền camera', 'Cho phép BHL One dùng camera để chụp ảnh xe.');
        return;
      }
    }
    const picker = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const picked = await picker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Ảnh quá lớn', 'Ảnh nhận diện không được vượt quá 5 MB.');
      return;
    }
    setImage(asset);
    setResult(undefined);
  };

  const recognize = async () => {
    if (!image || recognizing) return;
    setRecognizing(true);
    try {
      const formData = new FormData();
      formData.append(
        'image',
        {
          uri: image.uri,
          name: image.fileName || 'vehicle.jpg',
          type: image.mimeType || 'image/jpeg',
        } as unknown as Blob,
      );
      const response = await api.post<{ success: boolean; data: RecognitionResult }>(
        '/tools/license-plate-ai/recognize',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30_000 },
      );
      setResult(response.data.data);
    } catch (error) {
      Alert.alert('Không thể nhận diện biển số', getApiErrorMessage(error));
    } finally {
      setRecognizing(false);
    }
  };

  return (
    <Screen
      title="AI nhận dạng biển số"
      subtitle="Chụp hoặc chọn ảnh xe để nhận dạng"
      refreshing={health.isRefetching}
      onRefresh={() => void health.refetch()}
    >
      {health.isLoading ? <LoadingBlock /> : null}
      {health.isError ? <ErrorState text={getApiErrorMessage(health.error)} onRetry={() => void health.refetch()} /> : null}
      {health.data ? (
        <Card tone="soft">
          <View style={styles.heading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{health.data.status === 'ready' ? 'Dịch vụ AI sẵn sàng' : `Trạng thái: ${health.data.status}`}</Text>
              <Text style={styles.description}>Detector: {health.data.detectorClasses ?? '—'} lớp · OCR: {health.data.ocrClasses ?? '—'} lớp</Text>
            </View>
            <StatusBadge label={health.data.status === 'ready' ? 'Sẵn sàng' : 'Chưa sẵn sàng'} tone={health.data.status === 'ready' ? 'success' : 'warning'} />
          </View>
        </Card>
      ) : null}
      <Card>
        <Text style={styles.sectionTitle}>Ảnh xe</Text>
        {image ? <Image source={{ uri: image.uri }} resizeMode="contain" style={styles.preview} /> : <View style={styles.placeholder}><Text style={styles.placeholderText}>Chưa chọn ảnh</Text></View>}
        {image ? <Text numberOfLines={1} style={styles.fileName}>{image.fileName || image.uri.split('/').at(-1)}</Text> : null}
        <View style={styles.actions}>
          <View style={styles.action}><AppButton compact tone="secondary" label="Chọn ảnh" onPress={() => void chooseImage(false)} /></View>
          <View style={styles.action}><AppButton compact label="Chụp ảnh" onPress={() => void chooseImage(true)} /></View>
        </View>
        <AppButton
          label="Nhận diện biển số"
          loading={recognizing}
          disabled={!image || health.data?.status !== 'ready'}
          onPress={() => void recognize()}
        />
      </Card>
      {result ? (
        <Card tone={result.plate ? 'soft' : 'danger'}>
          <Text style={styles.sectionTitle}>Kết quả nhận diện</Text>
          {result.plate ? (
            <>
              <Text style={styles.plate}>{result.formattedPlate || result.plate}</Text>
              {result.plateImage ? (
                <Image
                  source={{ uri: `data:${result.plateImage.mimeType};base64,${result.plateImage.base64}` }}
                  resizeMode="contain"
                  style={styles.plateImage}
                />
              ) : null}
              <InfoRow label="Độ tin cậy phát hiện" value={`${Math.round(result.detectorConfidence * 100)}%`} />
              <InfoRow label="Độ tin cậy OCR" value={`${Math.round(result.ocrConfidence * 100)}%`} />
              <InfoRow label="Thời gian xử lý" value={`${result.processingMs} ms`} />
              {result.characters.length ? <Text style={styles.characters}>{result.characters.map(character => character.value).join(' · ')}</Text> : null}
            </>
          ) : (
            <Text style={styles.notFound}>Không phát hiện được biển số. Hãy thử ảnh rõ và chụp gần hơn.</Text>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: ui.gap },
  placeholder: { height: 210, borderRadius: ui.cardRadius, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.textMuted, fontWeight: '700' },
  preview: { width: '100%', height: 240, borderRadius: ui.cardRadius, backgroundColor: '#111827' },
  fileName: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  action: { flex: 1 },
  plate: { color: colors.primaryDark, textAlign: 'center', fontSize: 34, letterSpacing: 2, fontWeight: '700', marginVertical: 16 },
  plateImage: { width: '100%', height: 100, borderRadius: 10, backgroundColor: '#111827', marginBottom: 12 },
  characters: { color: colors.textMuted, textAlign: 'center', fontSize: 13, marginTop: 12 },
  notFound: { color: colors.danger, lineHeight: 21 },
});


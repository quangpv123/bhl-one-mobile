import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AppButton, Card, ErrorState, InfoRow, LoadingBlock, StatusBadge } from '@/components/ui';
import { api, getApiErrorMessage } from '@/services/api';
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
          <View className="flex-row items-start gap-2.5">
            <View className="flex-1">
              <Text className="text-card font-bold text-content">{health.data.status === 'ready' ? 'Dịch vụ AI sẵn sàng' : `Trạng thái: ${health.data.status}`}</Text>
              <Text className="mt-[5px] text-xs leading-[18px] text-content-muted">Detector: {health.data.detectorClasses ?? '—'} lớp · OCR: {health.data.ocrClasses ?? '—'} lớp</Text>
            </View>
            <StatusBadge label={health.data.status === 'ready' ? 'Sẵn sàng' : 'Chưa sẵn sàng'} tone={health.data.status === 'ready' ? 'success' : 'warning'} />
          </View>
        </Card>
      ) : null}
      <Card>
        <Text className="mb-2.5 text-card font-bold text-content">Ảnh xe</Text>
        {image ? <Image source={{ uri: image.uri }} resizeMode="contain" className="h-60 w-full rounded-card bg-gray-900" /> : <View className="h-[210px] items-center justify-center rounded-card bg-surface-muted"><Text className="font-bold text-content-muted">Chưa chọn ảnh</Text></View>}
        {image ? <Text numberOfLines={1} className="mt-2 text-xs text-content-muted">{image.fileName || image.uri.split('/').at(-1)}</Text> : null}
        <View className="my-3 flex-row gap-2">
          <View className="flex-1"><AppButton compact tone="secondary" label="Chọn ảnh" onPress={() => void chooseImage(false)} /></View>
          <View className="flex-1"><AppButton compact label="Chụp ảnh" onPress={() => void chooseImage(true)} /></View>
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
          <Text className="mb-2.5 text-card font-bold text-content">Kết quả nhận diện</Text>
          {result.plate ? (
            <>
              <Text className="my-4 text-center text-[34px] font-bold tracking-[2px] text-primary-dark">{result.formattedPlate || result.plate}</Text>
              {result.plateImage ? (
                <Image
                  source={{ uri: `data:${result.plateImage.mimeType};base64,${result.plateImage.base64}` }}
                  resizeMode="contain"
                  className="mb-3 h-[100px] w-full rounded-control bg-gray-900"
                />
              ) : null}
              <InfoRow label="Độ tin cậy phát hiện" value={`${Math.round(result.detectorConfidence * 100)}%`} />
              <InfoRow label="Độ tin cậy OCR" value={`${Math.round(result.ocrConfidence * 100)}%`} />
              <InfoRow label="Thời gian xử lý" value={`${result.processingMs} ms`} />
              {result.characters.length ? <Text className="mt-3 text-center text-body text-content-muted">{result.characters.map(character => character.value).join(' · ')}</Text> : null}
            </>
          ) : (
            <Text className="leading-[21px] text-danger">Không phát hiện được biển số. Hãy thử ảnh rõ và chụp gần hơn.</Text>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}


import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';

export function QrScannerModal({
  title = 'Quét mã QR vật tư',
  onClose,
  onDetected,
}: {
  title?: string;
  onClose: () => void;
  onDetected: (value: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-black">
        <View className="min-h-header flex-row items-center justify-between gap-3 bg-surface px-3">
          <Pressable onPress={onClose} hitSlop={8}><Text className="text-sm font-bold text-primary">Đóng</Text></Pressable>
          <Text className="flex-1 text-center text-card font-bold text-content">{title}</Text>
          <View className="w-[38px]" />
        </View>
        {!permission ? <View className="flex-1 items-center justify-center gap-3.5 bg-background p-7"><Text className="text-center text-sm leading-[21px] text-content-muted">Đang kiểm tra quyền camera…</Text></View> : null}
        {permission && !permission.granted ? (
          <View className="flex-1 items-center justify-center gap-3.5 bg-background p-7">
            <Text className="text-xl font-bold text-content">Cần quyền camera</Text>
            <Text className="text-center text-sm leading-[21px] text-content-muted">Cho phép BHL One sử dụng camera để đọc mã QR vật tư.</Text>
            <AppButton label="Cho phép camera" onPress={() => void requestPermission()} />
          </View>
        ) : null}
        {permission?.granted ? (
          <View className="flex-1">
            <CameraView
              className="absolute inset-0"
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : result => {
                setScanned(true);
                onDetected(result.data);
              }}
            />
            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <View className="h-[250px] w-[250px] rounded-card border-[3px] border-white bg-transparent" />
              <Text className="mt-[22px] overflow-hidden rounded-full bg-[rgba(0,0,0,0.62)] px-4 py-[9px] font-bold text-white">Đưa mã QR vào giữa khung hình</Text>
            </View>
            {scanned ? (
              <View className="absolute bottom-[30px] left-6 right-6">
                <AppButton label="Quét lại" onPress={() => setScanned(false)} />
              </View>
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

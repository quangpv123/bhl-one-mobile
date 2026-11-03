import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { colors, ui } from '@/theme/colors';

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
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={styles.close}>Đóng</Text></Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.spacer} />
        </View>
        {!permission ? <View style={styles.center}><Text style={styles.hint}>Đang kiểm tra quyền camera…</Text></View> : null}
        {permission && !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permissionTitle}>Cần quyền camera</Text>
            <Text style={styles.hint}>Cho phép BHL One sử dụng camera để đọc mã QR vật tư.</Text>
            <AppButton label="Cho phép camera" onPress={() => void requestPermission()} />
          </View>
        ) : null}
        {permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : result => {
                setScanned(true);
                onDetected(result.data);
              }}
            />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanHint}>Đưa mã QR vào giữa khung hình</Text>
            </View>
            {scanned ? (
              <View style={styles.rescan}>
                <AppButton label="Quét lại" onPress={() => setScanned(false)} />
              </View>
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  header: { minHeight: ui.headerHeight, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.surface },
  close: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  spacer: { width: 38 },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.background },
  permissionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  cameraWrap: { flex: 1 },
  overlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 250, height: 250, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: ui.cardRadius, backgroundColor: 'transparent' },
  scanHint: { marginTop: 22, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, overflow: 'hidden', color: '#FFFFFF', backgroundColor: 'rgba(0, 0, 0, 0.62)', fontWeight: '700' },
  rescan: { position: 'absolute', left: 24, right: 24, bottom: 30 },
});

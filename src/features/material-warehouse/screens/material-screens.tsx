import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, Text, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { QrScannerModal } from '@/components/qr-scanner-modal';
import {
  AppButton,
  Card,
  EmptyState,
  ErrorState,
  InfoRow,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import {
  api,
  apiBaseUrl,
  getApiErrorMessage,
  getProtectedApiHeaders,
  hasProtectedApiSession,
} from '@/services/api';
import type {
  MaterialInventoryUnit,
  MaterialIssueSummary,
  MaterialReceiptSummary,
  MaterialStock,
} from '@/types/business';
import type { ApiResponse } from '@/types/api';
import { formatDate, formatDateTime, formatNumber } from '@/utils/format';
import { RemoteListScreen } from '@/components/remote-list-screen';
import {
  appendMaterialImages,
  CreateMaterialIssueSheet,
  CreateMaterialReceiptSheet,
  MaterialEvidencePicker,
} from '../components/material-document-create';
import { FormField, ManagementSheet } from '@/components/forms/management-form';
import { requiredTextSchema } from '@/lib/validation';

interface MaterialEvidence {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByName: string;
  createdAt: string;
}
type MaterialDocumentLine = Record<string, unknown> & {
  evidence?: MaterialEvidence[];
  units?: Record<string, unknown>[];
};

type MaterialDocument = Record<string, unknown> & {
  lines?: MaterialDocumentLine[];
};

function documentStatus(status: string) {
  if (status === 'COMPLETED') return <StatusBadge label="Hoàn thành" tone="success" />;
  if (status === 'ISSUED') return <StatusBadge label="Đã xuất" tone="info" />;
  return <StatusBadge label="Bản nháp" tone="warning" />;
}
const materialStatusLabels: Record<string, string> = {
  IN_STOCK: 'Trong kho',
  ISSUED: 'Đang lắp đặt',
  PENDING_INSTALL: 'Chờ xác nhận lắp đặt',
  INSTALLED: 'Đã lắp đặt',
  PENDING_RETURN: 'Chờ xác nhận hoàn trả',
  PENDING_QUARANTINE: 'Chờ xác nhận sự cố',
  QUARANTINED: 'Sự cố chờ xử lý',
  DAMAGED: 'Hư hỏng',
};

const materialEventLabels: Record<string, string> = {
  RECEIVED: 'Nhập kho',
  ISSUED: 'Xuất kho',
  SCANNED: 'Quét kiểm tra',
  INSTALL_REQUESTED: 'Yêu cầu xác nhận lắp đặt',
  INSTALLED: 'Xác nhận lắp đặt',
  RETURN_REQUESTED: 'Yêu cầu hoàn trả',
  RETURNED: 'Hoàn trả',
  QUARANTINE_REQUESTED: 'Yêu cầu xác nhận sự cố',
  QUARANTINED: 'Sự cố chờ xử lý',
  DAMAGED: 'Xác nhận hư hỏng',
  RELEASED: 'Đưa lại vào kho',
};

type MaterialAction = 'install' | 'quarantine' | 'return' | 'damage' | 'release';

const materialActionSchema = z.object({
  action: z.enum(['install', 'quarantine', 'return', 'damage', 'release']),
  notes: z.string(),
  imageCount: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (['install', 'quarantine', 'return'].includes(value.action) && value.imageCount < 1) {
    context.addIssue({ code: 'custom', path: ['imageCount'], message: 'Chụp hoặc chọn ít nhất một ảnh vật tư.' });
  }
  if (['quarantine', 'damage', 'release'].includes(value.action) && value.notes.trim().length < 3) {
    context.addIssue({ code: 'custom', path: ['notes'], message: 'Ghi chú phải có ít nhất 3 ký tự.' });
  }
});

function normalizeQr(value: string) {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).searchParams.get('code') || trimmed;
  } catch {
    return trimmed;
  }
}
function EvidenceGallery({
  evidence,
  token,
  onPreview,
}: {
  evidence: MaterialEvidence[];
  token: string | null;
  onPreview: (evidence: MaterialEvidence) => void;
}) {
  if (!evidence.length || !hasProtectedApiSession(token)) return null;
  return (
    <View className="mt-[13px] gap-2">
      <Text className="text-xs font-bold text-content">Ảnh minh chứng ({evidence.length})</Text>
      <View className="flex-row flex-wrap gap-2">
        {evidence.map(image => (
          <Pressable key={image.id} onPress={() => onPreview(image)}>
            <Image
              source={{
                uri: `${apiBaseUrl}/material-inventory/evidence/${image.id}`,
                headers: getProtectedApiHeaders(token),
              }}
              className="h-[70px] w-[70px] rounded-[10px] bg-[#E4E7EC]"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function EvidencePreviewModal({
  evidence,
  token,
  onClose,
}: {
  evidence?: MaterialEvidence;
  token: string | null;
  onClose: () => void;
}) {
  if (!evidence || !hasProtectedApiSession(token)) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-[rgba(4,12,24,0.94)] px-[18px] pb-[30px] pt-[54px]">
        <Pressable className="self-end rounded-full bg-[rgba(255,255,255,0.14)] px-4 py-[9px]" onPress={onClose}>
          <Text className="font-bold text-white">Đóng</Text>
        </Pressable>
        <Image
          source={{
            uri: `${apiBaseUrl}/material-inventory/evidence/${evidence.id}`,
            headers: getProtectedApiHeaders(token),
          }}
          resizeMode="contain"
          className="w-full flex-1"
        />
        <Text numberOfLines={2} className="mt-2.5 text-center text-xs text-white">{evidence.fileName}</Text>
      </View>
    </Modal>
  );
}

export function MaterialInventoryScreen() {
  return (
    <RemoteListScreen<MaterialStock>
      queryKey="material-stocks"
      endpoint="/material-inventory/stocks"
      title="Tồn kho vật tư"
      subtitle="Số lượng khả dụng theo từng kho"
      emptyText="Chưa có dữ liệu tồn kho."
      renderItem={stock => (
        <Card key={`${stock.warehouseId}-${stock.materialId}`}>
          <View className="flex-row items-start justify-between gap-2.5">
            <View className="flex-1">
              <Text className="text-[15px] font-bold leading-[21px] text-content">{stock.materialName}</Text>
              <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{stock.materialCode}</Text>
            </View>
            <StatusBadge label={stock.trackingMode === 'QR' ? 'QR' : 'Số lượng'} tone="info" />
          </View>
          <View className="my-3.5 flex-row items-baseline gap-[5px]">
            <Text className="text-[28px] font-bold text-primary-dark">{formatNumber(stock.quantity, stock.unitDecimalScale)}</Text>
            <Text className="text-sm font-bold text-content-muted">{stock.unitSymbol}</Text>
          </View>
          <InfoRow label="Kho" value={`${stock.warehouseCode} — ${stock.warehouseName}`} />
          {stock.availableQrUnits != null ? <InfoRow label="QR khả dụng" value={formatNumber(stock.availableQrUnits, 0)} /> : null}
        </Card>
      )}
    />
  );
}

export function MaterialReceiptsScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <>
      <RemoteListScreen<MaterialReceiptSummary>
        queryKey="material-receipts"
        endpoint="/material-inventory/receipts"
        title="Phiếu nhập vật tư"
        subtitle="Nhập kho và phát hành QR"
        action={can(permissions.materialReceiptsCreate) ? <AppButton compact label="Thêm" onPress={() => setCreateOpen(true)} /> : undefined}
        emptyText="Chưa có phiếu nhập vật tư."
        renderItem={receipt => (
          <Pressable
            key={receipt.id}
            onPress={() => router.push({ pathname: '/material-record/[kind]/[id]', params: { kind: 'receipt', id: receipt.id } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <Card>
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold leading-[21px] text-content">{receipt.receiptNumber}</Text>
                  <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{formatDate(receipt.receivedAt)}</Text>
                </View>
                {documentStatus(receipt.status)}
              </View>
              <View className="mt-2.5">
                <InfoRow label="Kho nhập" value={`${receipt.warehouseCode} — ${receipt.warehouseName}`} />
                <InfoRow label="Nhà cung cấp" value={receipt.supplierName} />
                <InfoRow label="Số dòng" value={formatNumber(receipt.lineCount, 0)} />
                <InfoRow label="Tổng số lượng" value={formatNumber(receipt.totalQuantity)} emphasize />
              </View>
              <Text className="mt-3 text-right text-xs font-bold text-primary">Xem chi tiết →</Text>
            </Card>
          </Pressable>
        )}
      />
      {createOpen ? (
        <CreateMaterialReceiptSheet
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false);
            await queryClient.invalidateQueries({ queryKey: ['mobile-list', 'material-receipts'] });
            await queryClient.invalidateQueries({ queryKey: ['mobile-list', 'material-stocks'] });
          }}
        />
      ) : null}
    </>
  );
}

export function MaterialIssuesScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <>
      <RemoteListScreen<MaterialIssueSummary>
        queryKey="material-issues"
        endpoint="/material-inventory/issues"
        title="Xuất & hoàn trả vật tư"
        subtitle="Bàn giao vật tư và tiếp nhận hoàn trả"
        action={can(permissions.materialIssuesCreate) ? <AppButton compact label="Thêm" onPress={() => setCreateOpen(true)} /> : undefined}
        emptyText="Chưa có phiếu xuất vật tư."
        renderItem={issue => (
          <Pressable
            key={issue.id}
            onPress={() => router.push({ pathname: '/material-record/[kind]/[id]', params: { kind: 'issue', id: issue.id } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <Card>
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold leading-[21px] text-content">{issue.issueNumber}</Text>
                  <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{formatDate(issue.issuedAt)}</Text>
                </View>
                {documentStatus(issue.status)}
              </View>
              <View className="mt-2.5">
                <InfoRow label="Kho xuất" value={`${issue.warehouseCode} — ${issue.warehouseName}`} />
                <InfoRow label="Người nhận" value={issue.assigneeName} />
                <InfoRow label="Công việc" value={issue.jobCode || '—'} />
                <InfoRow label="Địa chỉ" value={issue.jobAddress || '—'} />
                <InfoRow label="Tổng số lượng" value={formatNumber(issue.totalQuantity)} emphasize />
              </View>
              <Text className="mt-3 text-right text-xs font-bold text-primary">Xem chi tiết →</Text>
            </Card>
          </Pressable>
        )}
      />
      {createOpen ? (
        <CreateMaterialIssueSheet
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false);
            await queryClient.invalidateQueries({ queryKey: ['mobile-list', 'material-issues'] });
            await queryClient.invalidateQueries({ queryKey: ['mobile-list', 'material-stocks'] });
          }}
        />
      ) : null}
    </>
  );
}

export function MaterialRecordDetailScreen({ kind, id }: { kind: 'receipt' | 'issue'; id: string }) {
  const { can, token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [previewEvidence, setPreviewEvidence] = useState<MaterialEvidence>();
  const query = useQuery({
    queryKey: ['material-document-mobile', kind, id],
    queryFn: async () =>
      (
        await api.get<ApiResponse<MaterialDocument>>(`/material-inventory/${kind === 'receipt' ? 'receipts' : 'issues'}/${id}`)
      ).data.data,
  });
  const record = query.data;
  const number = String(record?.[kind === 'receipt' ? 'receiptNumber' : 'issueNumber'] ?? '');
  const status = String(record?.status ?? 'DRAFT');
  const canApprove = kind === 'receipt'
    ? can(permissions.materialReceiptsApprove)
    : can(permissions.materialIssuesApprove);

  const runWorkflowAction = (action: 'confirm' | 'complete') => {
    const isReceipt = kind === 'receipt';
    const title = action === 'complete'
      ? 'Hoàn tất phiếu xuất?'
      : isReceipt ? 'Xác nhận nhập kho?' : 'Xác nhận xuất kho?';
    const description = action === 'complete'
      ? 'Phiếu xuất sẽ chuyển sang trạng thái hoàn thành.'
      : isReceipt
        ? 'Thao tác sẽ cộng tồn, sinh mã QR và không thể sửa phiếu sau đó.'
        : 'Thao tác sẽ trừ tồn, chuyển QR sang đã xuất và không thể sửa phiếu sau đó.';
    Alert.alert(title, description, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: () => {
          setSubmitting(true);
          void api
            .post(`/material-inventory/${isReceipt ? 'receipts' : 'issues'}/${id}/${action}`)
            .then(async () => {
              await query.refetch();
              Alert.alert('Thành công', action === 'complete' ? 'Đã hoàn tất phiếu xuất.' : isReceipt ? 'Đã xác nhận nhập kho.' : 'Đã xác nhận xuất kho.');
            })
            .catch(error => Alert.alert('Không thể thực hiện thao tác', getApiErrorMessage(error)))
            .finally(() => setSubmitting(false));
        },
      },
    ]);
  };

  return (
    <Screen
      title={number || (kind === 'receipt' ? 'Chi tiết phiếu nhập' : 'Chi tiết phiếu xuất')}
      subtitle={kind === 'receipt' ? 'Thông tin nhập kho vật tư' : 'Thông tin bàn giao vật tư'}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {record ? (
        <>
          <Card tone="soft">
            <View className="flex-row items-start justify-between gap-2.5">
              <Text className="text-[15px] font-bold leading-[21px] text-content">{number}</Text>
              {documentStatus(String(record.status ?? 'DRAFT'))}
            </View>
            <View className="mt-2.5">
              <InfoRow label="Kho" value={`${String(record.warehouseCode ?? '')} — ${String(record.warehouseName ?? '')}`} />
              {kind === 'receipt' ? <InfoRow label="Nhà cung cấp" value={String(record.supplierName ?? '—')} /> : null}
              {kind === 'issue' ? <InfoRow label="Người nhận" value={String(record.assigneeName ?? '—')} /> : null}
              <InfoRow label={kind === 'receipt' ? 'Ngày nhập' : 'Ngày xuất'} value={formatDate(String(record[kind === 'receipt' ? 'receivedAt' : 'issuedAt'] ?? ''))} />
              <InfoRow label="Người tạo" value={String(record.createdByName ?? '—')} />
              <InfoRow label="Ngày tạo" value={formatDateTime(String(record.createdAt ?? ''))} />
            </View>
            {status === 'DRAFT' && canApprove ? (
              <View className="mt-3.5">
                <AppButton
                  label={kind === 'receipt' ? 'Xác nhận nhập kho' : 'Xác nhận xuất kho'}
                  loading={submitting}
                  onPress={() => runWorkflowAction('confirm')}
                />
              </View>
            ) : null}
            {kind === 'issue' && status === 'ISSUED' && canApprove ? (
              <View className="mt-3.5">
                <AppButton label="Hoàn tất phiếu xuất" loading={submitting} onPress={() => runWorkflowAction('complete')} />
              </View>
            ) : null}
          </Card>
          <Text className="mt-1.5 text-[17px] font-bold text-content">Vật tư ({record.lines?.length ?? 0})</Text>
          {record.lines?.map((line, index) => {
            const evidence = Array.isArray(line.evidence) ? line.evidence : [];
            return (
              <Card key={String(line.id ?? index)}>
                <Text className="text-[15px] font-bold leading-[21px] text-content">{String(line.materialName ?? 'Vật tư')}</Text>
                <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{String(line.materialCode ?? '—')}</Text>
                <View className="mt-2.5">
                  <InfoRow label="Số lượng" value={`${formatNumber(Number(line.quantity ?? 0), Number(line.unitDecimalScale ?? 2))} ${String(line.unitSymbol ?? '')}`} emphasize />
                  {kind === 'issue' ? <InfoRow label="Đã hoàn trả" value={formatNumber(Number(line.returnedQuantity ?? 0))} /> : null}
                  <InfoRow label="Phương thức" value={line.trackingMode === 'QR' ? 'QR từng vật tư' : 'Theo số lượng'} />
                  <InfoRow label="Số QR" value={formatNumber(Array.isArray(line.units) ? line.units.length : 0, 0)} />
                </View>
                {line.units?.length ? (
                  <View className="mt-3 gap-[7px]">
                    {line.units.map((unit, unitIndex) => (
                      <View key={String(unit.id ?? unitIndex)} className="flex-row items-center gap-[9px] rounded-control bg-primary-soft p-[9px]">
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-content">{String(unit.manufacturerSerial || unit.qrPublicId || `QR #${unitIndex + 1}`)}</Text>
                          <Text className="mt-0.5 text-caption text-primary-dark">{String(unit.qrPublicId || '—')}</Text>
                        </View>
                        <StatusBadge label={materialStatusLabels[String(unit.status ?? '')] ?? String(unit.status ?? 'QR')} tone="info" />
                      </View>
                    ))}
                  </View>
                ) : null}
                <EvidenceGallery evidence={evidence} token={token} onPreview={setPreviewEvidence} />
              </Card>
            );
          })}
        </>
      ) : null}
      <EvidencePreviewModal evidence={previewEvidence} token={token} onClose={() => setPreviewEvidence(undefined)} />
    </Screen>
  );
}

export function MaterialQrScreen() {
  const { user, can, token } = useAuth();
  const [input, setInput] = useState('');
  const [qrPublicId, setQrPublicId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [action, setAction] = useState<MaterialAction>();
  const [actionNotes, setActionNotes] = useState('');
  const [actionImages, setActionImages] = useState<ImagePickerAsset[]>([]);
  const [actionValidationAttempted, setActionValidationAttempted] = useState(false);
  const [previewEvidence, setPreviewEvidence] = useState<MaterialEvidence>();
  const [submitting, setSubmitting] = useState(false);
  const query = useQuery({
    queryKey: ['material-qr-mobile', qrPublicId],
    enabled: Boolean(qrPublicId),
    retry: false,
    queryFn: async () =>
      (await api.get<ApiResponse<MaterialInventoryUnit>>(`/material-inventory/units/qr/${encodeURIComponent(qrPublicId)}`)).data.data,
  });

  const search = () => {
    const normalized = normalizeQr(input);
    if (normalized) setQrPublicId(normalized);
  };

  const openAction = (nextAction: MaterialAction) => {
    setActionNotes('');
    setActionImages([]);
    setActionValidationAttempted(false);
    setAction(nextAction);
  };

  const submitAction = async () => {
    const unit = query.data;
    if (!unit || !action) return;
    setActionValidationAttempted(true);
    const validation = materialActionSchema.safeParse({ action, notes: actionNotes, imageCount: actionImages.length });
    if (!validation.success) return;
    setSubmitting(true);
    try {
      if (action === 'install' || action === 'quarantine') {
        const formData = new FormData();
        formData.append('payload', JSON.stringify({ notes: actionNotes.trim() }));
        appendMaterialImages(formData, actionImages);
        await api.post(
          `/material-inventory/units/qr/${encodeURIComponent(unit.qrPublicId)}/${action}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
      } else if (action === 'return') {
        if (!unit.currentIssueId || !unit.materialId) throw new Error('Không xác định được phiếu xuất hoặc vật tư của serial này.');
        const formData = new FormData();
        formData.append('payload', JSON.stringify({
          issueId: unit.currentIssueId,
          notes: actionNotes.trim() || undefined,
          lines: [{
            materialId: unit.materialId,
            quantity: 1,
            unitIds: [unit.id],
            unitEvidence: [{ unitId: unit.id, evidenceCount: actionImages.length }],
          }],
        }));
        appendMaterialImages(formData, actionImages);
        await api.post('/material-inventory/returns', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post(`/material-inventory/units/qr/${encodeURIComponent(unit.qrPublicId)}/${action}`, {
          notes: actionNotes.trim(),
        });
      }
      setAction(undefined);
      await query.refetch();
      Alert.alert('Thành công', 'Đã cập nhật trạng thái vật tư.');
    } catch (error) {
      Alert.alert('Không thể cập nhật vật tư', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const approveAction = (type: 'install' | 'quarantine' | 'return') => {
    const unit = query.data;
    if (!unit) return;
    const label = type === 'install' ? 'lắp đặt' : type === 'quarantine' ? 'sự cố' : 'hoàn trả';
    Alert.alert(`Xác nhận ${label}?`, 'Trạng thái vật tư sẽ được cập nhật ngay.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: () => {
          setSubmitting(true);
          const endpoint = type === 'return'
            ? `/material-inventory/returns/${unit.pendingReturnId}/confirm`
            : `/material-inventory/units/qr/${encodeURIComponent(unit.qrPublicId)}/confirm-${type}`;
          void api.post(endpoint)
            .then(async () => {
              await query.refetch();
              Alert.alert('Thành công', `Đã xác nhận ${label}.`);
            })
            .catch(error => Alert.alert('Không thể xác nhận', getApiErrorMessage(error)))
            .finally(() => setSubmitting(false));
        },
      },
    ]);
  };

  return (
    <Screen title="Tra cứu vật tư QR" subtitle="Nhập mã QR để xem trạng thái và lịch sử">
      <SearchField placeholder="Mã QR vật tư" value={input} onChangeText={setInput} onSubmit={search} />
      <View className="flex-row gap-[9px]">
        <View className="flex-1"><AppButton label="Tra cứu" onPress={search} disabled={!input.trim()} loading={query.isFetching} /></View>
        <View className="flex-1"><AppButton tone="secondary" label="Quét QR" onPress={() => setScannerOpen(true)} /></View>
      </View>
      {!qrPublicId ? <EmptyState text="Nhập mã in trên tem QR để bắt đầu tra cứu." /> : null}
      {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <Card>
            <View className="flex-row items-start justify-between gap-2.5">
              <View className="flex-1">
                <Text className="text-[15px] font-bold leading-[21px] text-content">{query.data.materialName}</Text>
                <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{query.data.materialCode} · {query.data.qrPublicId}</Text>
              </View>
              <StatusBadge label={materialStatusLabels[query.data.status] ?? query.data.status} tone="info" />
            </View>
            <View className="mt-2.5">
              <InfoRow label="Serial NSX" value={query.data.manufacturerSerial || '—'} />
              <InfoRow label="Kho" value={query.data.warehouseName || query.data.warehouseCode || '—'} />
              <InfoRow label="Người giữ" value={query.data.currentHolderName || '—'} />
              <InfoRow label="Phiếu xuất" value={query.data.currentIssueNumber || '—'} />
              <InfoRow label="Công việc" value={query.data.assignedJobCode || '—'} />
              <InfoRow label="Địa chỉ" value={query.data.assignedJobAddress || '—'} />
            </View>
            <View className="mt-3.5 flex-row flex-wrap gap-2">
              {query.data.status === 'ISSUED' && query.data.currentHolderId === user?.id ? (
                <>
                  <AppButton compact label="Đã lắp đặt" onPress={() => openAction('install')} />
                  <AppButton compact tone="secondary" label="Hoàn trả" onPress={() => openAction('return')} />
                  <AppButton compact tone="danger" label="Báo sự cố" onPress={() => openAction('quarantine')} />
                </>
              ) : null}
              {can(permissions.materialInventoryUpdate) && query.data.status === 'PENDING_INSTALL' ? (
                <AppButton compact label="Xác nhận lắp đặt" loading={submitting} onPress={() => approveAction('install')} />
              ) : null}
              {can(permissions.materialInventoryUpdate) && query.data.status === 'PENDING_QUARANTINE' ? (
                <AppButton compact tone="danger" label="Xác nhận sự cố" loading={submitting} onPress={() => approveAction('quarantine')} />
              ) : null}
              {can(permissions.materialIssuesApprove) && query.data.status === 'PENDING_RETURN' && query.data.pendingReturnId ? (
                <AppButton compact label="Xác nhận hoàn trả" loading={submitting} onPress={() => approveAction('return')} />
              ) : null}
              {can(permissions.materialInventoryUpdate) && query.data.status === 'QUARANTINED' ? (
                <>
                  <AppButton compact tone="danger" label="Xác nhận hư hỏng" onPress={() => openAction('damage')} />
                  <AppButton compact tone="secondary" label="Đưa lại vào kho" onPress={() => openAction('release')} />
                </>
              ) : null}
            </View>
          </Card>
          {query.data.events?.length ? <Text className="mt-1.5 text-[17px] font-bold text-content">Lịch sử vật tư</Text> : null}
          {query.data.events?.map((event, index) => (
            <Card key={`${event.eventType}-${event.occurredAt}-${index}`}>
              <View className="flex-row items-start justify-between gap-2.5">
                <Text className="text-[15px] font-bold leading-[21px] text-content">{materialEventLabels[event.eventType] ?? event.eventType}</Text>
                <Text className="text-caption text-content-muted">{formatDateTime(event.occurredAt)}</Text>
              </View>
              <InfoRow label="Thực hiện bởi" value={event.employeeName} />
              {event.notes ? <Text className="mt-2 text-body leading-[19px] text-content-muted">{event.notes}</Text> : null}
              <EvidenceGallery evidence={event.evidence ?? []} token={token} onPreview={setPreviewEvidence} />
            </Card>
          ))}
        </>
      ) : null}
      {action ? (
        <ManagementSheet
          title={
            action === 'install' ? 'Gửi xác nhận lắp đặt'
              : action === 'quarantine' ? 'Báo sự cố vật tư'
                : action === 'return' ? 'Hoàn trả vật tư'
                  : action === 'damage' ? 'Xác nhận hư hỏng'
                    : 'Đưa vật tư lại vào kho'
          }
          saveLabel="Xác nhận thao tác"
          saving={submitting}
          onClose={() => setAction(undefined)}
          onSave={() => void submitAction()}
        >
          <FormField
            label={action === 'quarantine' || action === 'damage' || action === 'release' ? 'Ghi chú *' : 'Ghi chú'}
            schema={action === 'quarantine' || action === 'damage' || action === 'release'
              ? requiredTextSchema.min(3, 'Ghi chú phải có ít nhất 3 ký tự.')
              : undefined}
            value={actionNotes}
            editable={!submitting}
            multiline
            maxLength={1000}
            onChangeText={setActionNotes}
          />
          {action === 'install' || action === 'quarantine' || action === 'return' ? (
            <MaterialEvidencePicker images={actionImages} disabled={submitting} onChange={setActionImages} />
          ) : null}
          {actionValidationAttempted && !materialActionSchema.safeParse({ action, notes: actionNotes, imageCount: actionImages.length }).success && !actionImages.length && (action === 'install' || action === 'quarantine' || action === 'return') ? (
            <Text className="text-caption font-medium text-danger">Chụp hoặc chọn ít nhất một ảnh vật tư.</Text>
          ) : null}
        </ManagementSheet>
      ) : null}
      {scannerOpen ? (
        <QrScannerModal
          onClose={() => setScannerOpen(false)}
          onDetected={value => {
            const normalized = normalizeQr(value);
            setScannerOpen(false);
            setInput(normalized);
            setQrPublicId(normalized);
          }}
        />
      ) : null}
      <EvidencePreviewModal evidence={previewEvidence} token={token} onClose={() => setPreviewEvidence(undefined)} />
    </Screen>
  );
}

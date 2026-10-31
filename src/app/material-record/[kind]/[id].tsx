import { useLocalSearchParams } from 'expo-router';

import { MaterialRecordDetailScreen } from '@/features/material-warehouse';

export default function MaterialRecordRoute() {
  const { kind, id } = useLocalSearchParams<{ kind: 'receipt' | 'issue'; id: string }>();
  return <MaterialRecordDetailScreen kind={kind === 'issue' ? 'issue' : 'receipt'} id={id} />;
}


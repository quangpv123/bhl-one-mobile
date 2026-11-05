import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Text } from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingBlock, SearchField } from '@/components/ui';
import { api, getApiErrorMessage } from '@/services/api';
import type { PaginatedResponse } from '@/types/business';

export function RemoteListScreen<T>({
  queryKey,
  endpoint,
  title,
  subtitle,
  emptyText,
  renderItem,
  action,
  searchEnabled = true,
  params,
}: {
  queryKey: string;
  endpoint: string;
  title: string;
  subtitle?: string;
  emptyText: string;
  renderItem: (item: T, index: number) => ReactNode;
  action?: ReactNode;
  searchEnabled?: boolean;
  params?: Record<string, unknown>;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['mobile-list', queryKey, search, params],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<T>>(endpoint, {
          params: { page: 1, limit: 100, ...params, search: search || undefined },
        })
      ).data,
  });

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      action={action}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      {searchEnabled ? (
        <SearchField
          placeholder="Tìm kiếm..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
      ) : null}
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text={emptyText} /> : null}
      {query.data?.data.map(renderItem)}
      {query.data?.pagination ? (
        <Text className="py-2 text-center text-xs text-content-muted">
          Tổng {query.data.pagination.total.toLocaleString('vi-VN')} bản ghi
        </Text>
      ) : null}
    </Screen>
  );
}


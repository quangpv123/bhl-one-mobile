import type { PropsWithChildren, ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { AppHeader } from './app-shell';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onTouchStart?: ViewProps['onTouchStart'];
  scrollEnabled?: boolean;
}

export function Screen({
  title,
  subtitle,
  action,
  footer,
  children,
  refreshing = false,
  onRefresh,
  onTouchStart,
  scrollEnabled = true,
}: ScreenProps) {
  const content = (
    <>
      {subtitle || action ? (
        <View className="min-h-[30px] flex-row items-center gap-2.5">
          {subtitle ? (
            typeof subtitle === 'string' ? (
              <Text numberOfLines={2} className="flex-1 text-label font-normal text-content-muted">{subtitle}</Text>
            ) : (
              <View className="min-w-0 flex-1">{subtitle}</View>
            )
          ) : <View className="flex-1" />}
          {action ? <View className="shrink-0 items-end">{action}</View> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={['top', 'right', 'bottom', 'left']}
      onTouchStart={onTouchStart}
    >
      <AppHeader title={title} />
      {scrollEnabled ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-2.5 px-page-x pb-page-b pt-page-t"
          refreshControl={onRefresh ? (
            <RefreshControl colors={[colors.primary]} tintColor={colors.primary} refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined}
        >
          {content}
        </ScrollView>
      ) : (
        <View className="flex-1 gap-2.5 px-page-x pb-page-b pt-page-t">{content}</View>
      )}
      {footer ? <View className="shrink-0 bg-surface">{footer}</View> : null}
    </SafeAreaView>
  );
}

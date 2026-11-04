import type { PropsWithChildren, ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography, ui } from '@/theme/colors';
import { AppHeader } from './app-shell';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
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
        <View style={styles.contextRow}>
          {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : <View style={styles.contextSpacer} />}
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'right', 'bottom', 'left']}
      onTouchStart={onTouchStart}
    >
      <AppHeader title={title} />
      {scrollEnabled ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={onRefresh ? (
            <RefreshControl colors={[colors.primary]} tintColor={colors.primary} refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fixedContent]}>{content}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingTop: ui.pagePaddingTop,
    paddingHorizontal: ui.pagePaddingHorizontal,
    paddingBottom: ui.pagePaddingBottom,
    gap: ui.gap,
  },
  fixedContent: { flex: 1 },
  footer: { flexShrink: 0, backgroundColor: colors.surface },
  contextRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextSpacer: { flex: 1 },
  subtitle: { flex: 1, color: colors.textMuted, ...typography.label, fontWeight: '400' },
  action: { flexShrink: 0, alignItems: 'flex-end' },
});

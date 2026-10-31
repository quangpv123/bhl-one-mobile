import type { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, ui } from '@/theme/colors';
import { AppHeader } from './app-shell';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function Screen({ title, subtitle, action, children, refreshing = false, onRefresh }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader title={title} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={onRefresh ? (
          <RefreshControl colors={[colors.primary]} tintColor={colors.primary} refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined}
      >
        {subtitle || action ? (
          <View style={styles.contextRow}>
            {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : <View style={styles.contextSpacer} />}
            {action ? <View style={styles.action}>{action}</View> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: ui.pagePaddingTop,
    paddingHorizontal: ui.pagePaddingHorizontal,
    paddingBottom: ui.pagePaddingBottom,
    gap: ui.gap,
  },
  contextRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextSpacer: { flex: 1 },
  subtitle: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  action: { flexShrink: 0, alignItems: 'flex-end' },
});

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState, SectionTitle } from '@/components/ui';
import { AppIcon } from '@/components/app-icon';
import { canOpenFeature, featureGroups, featureHref, mobileFeatures } from '@/navigation/moduleRegistry';
import { useAuth } from '@/features/auth/auth-context';
import { colors } from '@/theme/colors';

export default function WorkScreen() {
  const { user } = useAuth();
  const allowedFeatures = mobileFeatures.filter(feature => canOpenFeature(feature, user?.permissions ?? []));

  return (
    <Screen title="Chức năng" subtitle={`${allowedFeatures.length} chức năng theo quyền tài khoản`}>
      {!allowedFeatures.length ? <EmptyState text="Tài khoản chưa được cấp quyền sử dụng chức năng nghiệp vụ." /> : null}
      {featureGroups.map(group => {
        const items = allowedFeatures.filter(feature => feature.group === group.key);
        if (!items.length) return null;
        return (
          <View key={group.key} style={styles.group}>
            <SectionTitle>{group.title}</SectionTitle>
            <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
            <View style={styles.grid}>
              {items.map(feature => (
                <Pressable
                  accessibilityRole="button"
                  key={feature.key}
                  onPress={() => router.push(featureHref(feature) as never)}
                  style={({ pressed }) => [styles.featureCard, pressed && styles.pressed]}
                >
                  <View style={styles.iconWrap}>
                    <AppIcon name={feature.icon} color={colors.primary} size={20} />
                  </View>
                  <Text style={styles.title}>{feature.title}</Text>
                  <Text style={styles.subtitle}>{feature.subtitle}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 5, marginBottom: 8 },
  groupSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: '48.4%',
    minHeight: 132,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  iconWrap: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
});


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
    <Screen title="Chức năng">
      {!allowedFeatures.length ? <EmptyState text="Tài khoản chưa được cấp quyền sử dụng chức năng nghiệp vụ." /> : null}
      {featureGroups.map(group => {
        const items = allowedFeatures.filter(feature => feature.group === group.key);
        if (!items.length) return null;
        return (
          <View key={group.key} style={styles.group}>
            <SectionTitle>{group.title}</SectionTitle>
            <View style={styles.grid}>
              {items.map(feature => (
                <Pressable
                  accessibilityRole="button"
                  key={feature.key}
                  onPress={() => router.push(featureHref(feature) as never)}
                  style={({ pressed }) => [styles.featureCard, pressed && styles.pressed]}
                >
                  <View style={styles.iconWrap}>
                    <AppIcon name={feature.icon} color={colors.primary} size={18} />
                  </View>
                  <Text numberOfLines={2} style={styles.title}>{feature.title}</Text>
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
  group: { gap: 8, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureCard: {
    width: '23%',
    minHeight: 88,
    paddingHorizontal: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  iconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  title: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
});


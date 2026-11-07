import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState, SectionTitle } from '@/components/ui';
import { AppIcon } from '@/components/app-icon';
import { canOpenFeature, featureGroups, featureHref, mobileFeatures } from '@/navigation/moduleRegistry';
import { useAuth } from '@/features/auth/auth-context';
import { colors } from '@/theme/colors';

export default function WorkScreen() {
  const { user } = useAuth();
  const allowedFeatures = mobileFeatures.filter(feature =>
    canOpenFeature(feature, user?.permissions ?? [], user?.role),
  );

  return (
    <Screen title="Chức năng">
      {!allowedFeatures.length ? <EmptyState text="Tài khoản chưa được cấp quyền sử dụng chức năng nghiệp vụ." /> : null}
      {featureGroups.map(group => {
        const items = allowedFeatures.filter(feature => feature.group === group.key);
        if (!items.length) return null;
        return (
          <View key={group.key} className="mb-2 gap-2">
            <SectionTitle>{group.title}</SectionTitle>
            <View className="flex-row flex-wrap gap-2">
              {items.map(feature => (
                <Pressable
                  accessibilityRole="button"
                  key={feature.key}
                  onPress={() => router.push(featureHref(feature) as never)}
                  className="min-h-[88px] w-[23%] items-center px-[5px] py-[9px]"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
                >
                  <View className="mb-[7px] h-8 w-8 items-center justify-center rounded-compact bg-primary-soft">
                    <AppIcon name={feature.icon} color={colors.primary} size={18} />
                  </View>
                  <Text
                    numberOfLines={2}
                    className="min-h-[30px] w-full text-center text-caption font-semibold leading-[15px] text-content"
                  >
                    {feature.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}


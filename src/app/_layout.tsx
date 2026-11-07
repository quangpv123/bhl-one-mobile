import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import '../../global.css';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { colors } from '@/theme/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
    mutations: { retry: 0 },
  },
});

function RootNavigator() {
  const { loading, user } = useAuth();
  const segments = useSegments();
  const firstSegment = segments[0] as string | undefined;

  useEffect(() => {
    if (loading || !firstSegment) return;
    if (!user && firstSegment !== 'login') {
      router.replace('/login');
      return;
    }
    if (user && firstSegment === 'login') router.replace('/(app)');
  }, [firstSegment, loading, user]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontSize: 18, fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Tin nhắn' }} />
        <Stack.Screen name="feature/[key]" options={{ headerShown: false }} />
        <Stack.Screen name="purchase-warehouse/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="material-record/[kind]/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </KeyboardProvider>
  );
}

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ProfileProvider, useProfile } from '../src/features/onboarding/ProfileContext';
import { initAnalytics } from '../src/lib/analytics';
import { initPurchases } from '../src/lib/purchases';
import { initSentry } from '../src/lib/sentry';

// AC-017: 起動時のクラッシュも捕捉できるよう、モジュール読み込み時点(コンポーネント初回描画より前)で初期化する。
// DSN未設定時は初期化をスキップする(初期化の実処理はsentry.ts側でskip判定を行う)。
initSentry();

function RootNavigator() {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return <View style={{ flex: 1 }} />;
  }

  const isAgeConfirmed = profile.ageConfirmedAt !== null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAgeConfirmed}>
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/ineligible" />
      </Stack.Protected>
      <Stack.Protected guard={isAgeConfirmed}>
        <Stack.Screen name="index" />
        <Stack.Screen name="photo-assessment" />
        <Stack.Screen name="reply-assist" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="history/index" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initPurchases();
    initAnalytics();
  }, []);

  return (
    <ProfileProvider>
      <RootNavigator />
    </ProfileProvider>
  );
}

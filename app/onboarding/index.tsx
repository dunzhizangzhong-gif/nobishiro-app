import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '../../src/features/onboarding/ProfileContext';
import { trackEvent } from '../../src/lib/analytics';

const VALUE_SLIDES = [
  {
    key: 'reasoning',
    title: 'なぜ良いか、理由まで教えてくれる',
    body: 'AIが写真やメッセージの改善ポイントを、理由つきで提案します。',
    copyTestId: 'onboarding-copy-reasoning',
    copyText: 'なぜこの写真が良いか、根拠を示します',
  },
  {
    key: 'trust',
    title: '信頼できるアドバイスだけ',
    body: '実在の人物に似せた画像生成は行いません。安心して使えるコーチです。',
    copyTestId: 'onboarding-copy-trust',
    copyText: '実在の人物に似せた画像は作りません。信頼できるアドバイスだけを届けます',
  },
] as const;

const TOTAL_PAGES = VALUE_SLIDES.length + 1;

export default function Onboarding() {
  const [pageIndex, setPageIndex] = useState(0);
  const router = useRouter();
  const { confirmAge } = useProfile();

  const isAgeGatePage = pageIndex === VALUE_SLIDES.length;
  const currentSlide = VALUE_SLIDES[pageIndex];

  const handleAgeAnswer = async (isAdult: boolean) => {
    if (isAdult) {
      await confirmAge(true);
      // AC-015: onboarding_completed
      trackEvent({ name: 'onboarding_completed' });
      router.replace('/');
    } else {
      router.replace('/onboarding/ineligible');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.slide}>
        {!isAgeGatePage && currentSlide ? (
          <>
            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.body}>{currentSlide.body}</Text>
            <Text testID={currentSlide.copyTestId} style={styles.copy}>
              {currentSlide.copyText}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>ご利用には年齢確認が必要です</Text>
            <Text style={styles.body}>あなたは18歳以上ですか?</Text>
            <Pressable
              testID="onboarding-age-yes"
              style={styles.primaryButton}
              onPress={() => handleAgeAnswer(true)}
            >
              <Text style={styles.primaryButtonText}>はい(18歳以上)</Text>
            </Pressable>
            <Pressable
              testID="onboarding-age-no"
              style={styles.secondaryButton}
              onPress={() => handleAgeAnswer(false)}
            >
              <Text style={styles.secondaryButtonText}>いいえ(18歳未満)</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_PAGES }).map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === pageIndex && styles.dotActive]}
            />
          ))}
        </View>

        {!isAgeGatePage && (
          <Pressable
            testID="onboarding-next"
            style={styles.primaryButton}
            onPress={() => setPageIndex((current) => current + 1)}
          >
            <Text style={styles.primaryButtonText}>次へ</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  copy: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    gap: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    backgroundColor: '#333333',
  },
  primaryButton: {
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

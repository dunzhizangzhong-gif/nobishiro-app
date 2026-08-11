import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEntitlement } from '../src/features/paywall/useEntitlement';
import { hasRemainingQuota } from '../src/features/quota/quotaGate';
import { useQuota } from '../src/features/quota/useQuota';

export default function Home() {
  const router = useRouter();
  const { isLoading, remainingPhotoAssessments, remainingReplyGenerations } = useQuota();
  const { isPro } = useEntitlement();

  const handlePhotoCTA = async () => {
    if (!isPro && !(await hasRemainingQuota('photoAssessments'))) {
      router.push('/paywall?intent=photo-assessment');
      return;
    }
    router.push('/photo-assessment/select');
  };

  const handleReplyCTA = async () => {
    if (!isPro && !(await hasRemainingQuota('replyGenerations'))) {
      router.push('/paywall?intent=reply-assist');
      return;
    }
    router.push('/reply-assist/input');
  };

  return (
    <View style={styles.container} testID="home-placeholder">
      <View style={styles.header}>
        <Text style={styles.appName}>nobishiro</Text>
        {!isLoading && isPro && (
          <Text testID="home-pro-badge" style={styles.proBadge}>
            Pro
          </Text>
        )}
        {!isLoading && !isPro && (
          <Text testID="home-quota-summary" style={styles.quota}>
            写真判定 残り{remainingPhotoAssessments}回 ・ 返信案 残り{remainingReplyGenerations}回
          </Text>
        )}
      </View>

      <View style={styles.ctaGroup}>
        <Pressable testID="home-cta-photo" style={styles.primaryButton} onPress={handlePhotoCTA}>
          <Text style={styles.primaryButtonText}>写真をみてもらう</Text>
        </Pressable>
        <Pressable testID="home-cta-reply" style={styles.primaryButton} onPress={handleReplyCTA}>
          <Text style={styles.primaryButtonText}>返信を考えてもらう</Text>
        </Pressable>
      </View>

      <View style={styles.footerLinks}>
        <Pressable testID="home-history-link" style={styles.historyLink} onPress={() => router.push('/history')}>
          <Text style={styles.historyLinkText}>履歴を見る</Text>
        </Pressable>
        <Pressable testID="home-settings-link" style={styles.historyLink} onPress={() => router.push('/settings')}>
          <Text style={styles.historyLinkText}>設定</Text>
        </Pressable>
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
  header: {
    gap: 8,
  },
  appName: {
    fontSize: 20,
    fontWeight: '600',
  },
  quota: {
    fontSize: 14,
    color: '#555555',
  },
  proBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ctaGroup: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#111111',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  historyLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyLinkText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

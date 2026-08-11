import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEntitlement } from '../src/features/paywall/useEntitlement';
import { trackEvent } from '../src/lib/analytics';
import { isPurchasesConfigured } from '../src/lib/purchases';

type OfferingsState = 'loading' | 'unavailable' | { packages: PurchasesPackage[] };

function resolveIntentPath(intent: string | undefined): '/photo-assessment/select' | '/reply-assist/input' | null {
  if (intent === 'photo-assessment') return '/photo-assessment/select';
  if (intent === 'reply-assist') return '/reply-assist/input';
  return null;
}

export default function Paywall() {
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const entitlement = useEntitlement();
  const [offerings, setOfferings] = useState<OfferingsState>('loading');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const goToIntentOrBack = () => {
    const path = resolveIntentPath(intent);
    if (path) {
      router.replace(path);
    } else {
      router.back();
    }
  };

  useEffect(() => {
    // AC-015: paywall_viewed
    trackEvent({ name: 'paywall_viewed' });
  }, []);

  useEffect(() => {
    if (!isPurchasesConfigured()) {
      setOfferings('unavailable');
      return;
    }
    let active = true;
    Purchases.getOfferings()
      .then((result) => {
        if (!active) return;
        const packages = result.current?.availablePackages ?? [];
        setOfferings(packages.length > 0 ? { packages } : 'unavailable');
      })
      .catch(() => {
        if (active) setOfferings('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // AC-010: 購入完了後は元のフローに復帰する。entitlement.refresh()後の反映も同じ経路でハンドリングする
    if (entitlement.isPro) {
      goToIntentOrBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlement.isPro]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setErrorMessage(null);
    setPurchasingId(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      // AC-015: purchase_completed
      trackEvent({ name: 'purchase_completed' });
      await entitlement.refresh();
    } catch (error) {
      const userCancelled = (error as { userCancelled?: boolean | null } | null)?.userCancelled;
      if (!userCancelled) {
        setErrorMessage('購入処理に失敗しました');
      }
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestore = async () => {
    setErrorMessage(null);
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await entitlement.refresh();
    } catch {
      setErrorMessage('復元に失敗しました');
    } finally {
      setRestoring(false);
    }
  };

  if (offerings === 'loading') {
    return (
      <View style={styles.centered} testID="paywall-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (offerings === 'unavailable') {
    return (
      <View style={styles.centered}>
        <Text testID="paywall-unavailable-message" style={styles.message}>
          現在ご利用いただけません
        </Text>
        {isPurchasesConfigured() && (
          <Pressable testID="paywall-restore" disabled={restoring} onPress={handleRestore}>
            <Text style={styles.linkText}>購入を復元</Text>
          </Pressable>
        )}
        {errorMessage && (
          <Text testID="paywall-error-message" style={styles.errorText}>
            {errorMessage}
          </Text>
        )}
        <Pressable testID="paywall-close" style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>閉じる</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text testID="paywall-title" style={styles.title}>
        無制限プランに登録
      </Text>
      <Text style={styles.body}>写真判定・返信支援を無制限に利用できます</Text>

      {offerings.packages.map((pkg) => (
        <View key={pkg.identifier} style={styles.packageCard}>
          <Text testID={`paywall-price-${pkg.identifier}`} style={styles.price}>
            {pkg.product.priceString}
          </Text>
          <Pressable
            testID={`paywall-purchase-${pkg.identifier}`}
            disabled={purchasingId !== null}
            style={styles.purchaseButton}
            onPress={() => handlePurchase(pkg)}
          >
            <Text style={styles.purchaseButtonText}>
              {purchasingId === pkg.identifier ? '処理中...' : '購入する'}
            </Text>
          </Pressable>
        </View>
      ))}

      {errorMessage && (
        <Text testID="paywall-error-message" style={styles.errorText}>
          {errorMessage}
        </Text>
      )}

      <Pressable testID="paywall-restore" disabled={restoring} onPress={handleRestore}>
        <Text style={styles.linkText}>{restoring ? '復元中...' : '購入を復元'}</Text>
      </Pressable>

      <Pressable testID="paywall-close" style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.linkText}>閉じる</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    color: '#555555',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  packageCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
  },
  purchaseButton: {
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    color: '#B00020',
    textAlign: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 8,
  },
});

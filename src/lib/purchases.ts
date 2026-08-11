import Purchases from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'pro';

let configured = false;

// AC-017(Sentry)と同じ方針: APIキー未設定時は初期化をスキップしクラッシュさせない。
// RevenueCatダッシュボード側の設定(entitlement/offering/APIキー発行)は別途人間が実施する
// (specs/release-checklist.md参照)。
export function initPurchases(): void {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (!apiKey) {
    return;
  }
  if (configured) {
    return;
  }
  Purchases.configure({ apiKey });
  configured = true;
}

export function isPurchasesConfigured(): boolean {
  return configured;
}

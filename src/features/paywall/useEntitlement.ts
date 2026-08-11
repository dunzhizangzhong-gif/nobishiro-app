import { useCallback, useEffect, useState } from 'react';

import Purchases from 'react-native-purchases';

import { PRO_ENTITLEMENT_ID, isPurchasesConfigured } from '../../lib/purchases';

export type EntitlementState = {
  isPro: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export function useEntitlement(): EntitlementState {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    // RevenueCat未設定(APIキー未発行)の場合はローカル無料枠判定に委ねる
    if (!isPurchasesConfigured()) {
      setIsPro(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const info = await Purchases.getCustomerInfo();
      setIsPro(Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID]));
    } catch {
      // AC-011 失敗時: entitlement取得に失敗した場合はローカルの無料枠判定にフォールバックする
      setIsPro(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isPro, isLoading, refresh };
}

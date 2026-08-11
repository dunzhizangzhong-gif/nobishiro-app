import { useCallback, useEffect, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { getQuota } from '../../lib/storage';
import type { Quota } from '../../types/domain';

export const FREE_LIMITS = {
  photoAssessments: 3,
  replyGenerations: 5,
} as const;

const DEFAULT_QUOTA: Quota = { photoAssessmentsUsed: 0, replyGenerationsUsed: 0 };

export type QuotaView = {
  isLoading: boolean;
  quota: Quota;
  remainingPhotoAssessments: number;
  remainingReplyGenerations: number;
  refresh: () => Promise<void>;
};

export function useQuota(): QuotaView {
  const [quota, setQuota] = useState<Quota>(DEFAULT_QUOTA);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const loaded = await getQuota();
    setQuota(loaded);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 写真判定・返信支援の実行後にホームへ戻った際、残り回数表示を最新化するため
  // 画面フォーカス時にも再取得する(AC-009: ホームの残り回数表示が更新される)。
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return {
    isLoading,
    quota,
    remainingPhotoAssessments: Math.max(0, FREE_LIMITS.photoAssessments - quota.photoAssessmentsUsed),
    remainingReplyGenerations: Math.max(0, FREE_LIMITS.replyGenerations - quota.replyGenerationsUsed),
    refresh,
  };
}

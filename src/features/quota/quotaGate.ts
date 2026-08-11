import { FREE_LIMITS } from './useQuota';
import { getQuota, setQuota } from '../../lib/storage';

export type QuotaKind = 'photoAssessments' | 'replyGenerations';

function usedCount(quota: { photoAssessmentsUsed: number; replyGenerationsUsed: number }, kind: QuotaKind): number {
  return kind === 'photoAssessments' ? quota.photoAssessmentsUsed : quota.replyGenerationsUsed;
}

// AC-010: ホームのCTAタップ時、無料枠超過をペイウォール表示前に判定する
export async function hasRemainingQuota(kind: QuotaKind): Promise<boolean> {
  const quota = await getQuota();
  const limit = kind === 'photoAssessments' ? FREE_LIMITS.photoAssessments : FREE_LIMITS.replyGenerations;
  return usedCount(quota, kind) < limit;
}

// AC-009: 成功時のみ1回増加。AC-011: Pro中は消費しない(呼び出し側でconsumesQuota=falseにする)。
export async function incrementQuota(kind: QuotaKind): Promise<void> {
  const quota = await getQuota();
  const next =
    kind === 'photoAssessments'
      ? { ...quota, photoAssessmentsUsed: quota.photoAssessmentsUsed + 1 }
      : { ...quota, replyGenerationsUsed: quota.replyGenerationsUsed + 1 };
  try {
    await setQuota(next);
  } catch {
    // AC-009 失敗時: カウンタ書き込みに失敗した場合は次回起動時に再計算せず現値を維持する
    // (書き込み前の永続化済み値がそのまま有効であり続けるため、ここでは何もしない)
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ProxyRequestError,
  RateLimitedError,
  assessPhotos,
  type PhotoAssessmentApiResponse,
  type SelectedPhoto,
} from '../../lib/api/photoAssessmentClient';
import { trackEvent } from '../../lib/analytics';
import { incrementQuota } from '../quota/quotaGate';
import { generateId } from '../../lib/id';
import { addAssessment } from '../../lib/storage';
import { sanitizePhotoAssessmentResult } from '../../lib/textFilter/applyFilter';
import type { PhotoAssessment } from '../../types/domain';

// spec.md AC-002: 60秒でタイムアウトとしてエラー+再試行導線を出す
export const REQUEST_TIMEOUT_MS = 60_000;

export type SubmissionPhase =
  | { status: 'pending' }
  | { status: 'success'; assessmentId: string }
  | { status: 'timeout' }
  | { status: 'cancelled' }
  // AC-023: プロキシのレート制限超過(HTTP 429)。無料枠は消費しない
  | { status: 'rate_limited' }
  // AC-022: バッチ内の写真が(除外の結果)1枚も残らず、全てモデレーション判定で除外された。無料枠は消費しない
  | { status: 'guideline_violation' }
  // AC-024: バッチ内の写真が(除外の結果)1枚も残らず、人物検出に失敗した写真のみだった。無料枠は消費しない
  | { status: 'no_person_detected' }
  | { status: 'error'; message: string };

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

// AC-022/AC-024: 全滅時にどちらの案内を表示するか決める。混在時はガイドライン違反を優先する
// (ポリシー起因の拒否は人物検出の案内より優先度が高いという判断。単体では未検証の設計判断)。
function resolveAllExcludedPhase(
  entries: Extract<PhotoAssessmentApiResponse['entries'][number], { status: 'excluded' }>[]
): 'guideline_violation' | 'no_person_detected' {
  return entries.some((entry) => entry.reason === 'moderation') ? 'guideline_violation' : 'no_person_detected';
}

function buildAssessment(
  photos: SelectedPhoto[],
  response: PhotoAssessmentApiResponse,
  includedIndexes: number[]
): PhotoAssessment {
  const excludedCount = response.entries.length - includedIndexes.length;
  const recommendedNewIndex = includedIndexes.indexOf(response.recommendedIndex);

  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    // assetIdはフォトライブラリ権限が「限定」の場合にnullになりうる(expo-image-picker仕様)。
    // その場合はpicker生成のキャッシュuriにフォールバックする。uriはassetIdと異なり
    // ライブラリへの安定参照ではなくアプリ専用キャッシュ内の一時ファイルパスであり、
    // 将来の履歴再表示(AC-012)でassetIdより解決に失敗しやすい既知の制限(decision-log.md DL-013)。
    // AC-022/AC-024: 除外された写真のrefは保存しない(photoRefsとresultsの添字を一致させる)
    photoRefs: includedIndexes.map((index) => photos[index].assetId ?? photos[index].uri),
    recommendedIndex: recommendedNewIndex,
    // AC-003/AC-004: 表示前に禁止パターン(出典誤認・体型変化を促す表現)を除去する
    results: includedIndexes.map((index) => {
      const entry = response.entries[index];
      // includedIndexesはstatus==='included'のentryのみを指すため、ここで必ずincludedになる
      const { status: _status, ...result } = entry as Extract<typeof entry, { status: 'included' }>;
      return sanitizePhotoAssessmentResult(result);
    }),
    // AC-022/AC-024(decision-log.md DL-006): 除外があったことをS-5に表示するための件数
    excludedCount: excludedCount > 0 ? excludedCount : undefined,
  };
}

export function usePhotoAssessmentSubmission(photos: SelectedPhoto[], options?: { consumesQuota?: boolean }) {
  const consumesQuota = options?.consumesQuota ?? true;
  const [phase, setPhase] = useState<SubmissionPhase>({ status: 'pending' });
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // AC-002/AC-006(DL-008): 再試行・再生成では無料枠を追加消費しない。
  // 「まだこのセッションで一度も消費していない」場合のみ、成功時に1回だけ消費する。
  const quotaConsumedRef = useRef(false);

  const submit = useCallback(async () => {
    cancelledRef.current = false;
    setPhase({ status: 'pending' });
    const startedAt = Date.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // AC-015: photo_submitted。写真そのものは送らず、送信という操作の発生のみを記録する
      trackEvent({ name: 'photo_submitted' });
      const response = await assessPhotos(photos, controller.signal);
      const includedIndexes = response.entries
        .map((entry, index) => (entry.status === 'included' ? index : -1))
        .filter((index) => index !== -1);

      // AC-022/AC-024: 除外の結果、判定対象の写真が1枚も残らなかった場合は無料枠を消費せず専用画面へ
      if (includedIndexes.length === 0) {
        const excludedEntries = response.entries as Extract<
          (typeof response.entries)[number],
          { status: 'excluded' }
        >[];
        setPhase({ status: resolveAllExcludedPhase(excludedEntries) });
        return;
      }

      const assessment = buildAssessment(photos, response, includedIndexes);
      await addAssessment(assessment);
      if (consumesQuota && !quotaConsumedRef.current) {
        await incrementQuota('photoAssessments');
        quotaConsumedRef.current = true;
      }
      // AC-015: assessment_completed(所要秒数をプロパティに含む)
      trackEvent({
        name: 'assessment_completed',
        properties: { durationSeconds: Math.round((Date.now() - startedAt) / 1000) },
      });
      setPhase({ status: 'success', assessmentId: assessment.id });
    } catch (error) {
      if (cancelledRef.current) {
        setPhase({ status: 'cancelled' });
      } else if (isAbortError(error)) {
        setPhase({ status: 'timeout' });
      } else if (error instanceof RateLimitedError) {
        // AC-023: レート制限超過。無料枠は消費しない
        setPhase({ status: 'rate_limited' });
      } else if (error instanceof ProxyRequestError) {
        // AC-023 失敗時: レート制限機構自体のエラーもfail-closed(通信エラーと同じ扱い)とする
        setPhase({ status: 'error', message: '通信エラーが発生しました' });
      } else {
        setPhase({ status: 'error', message: '判定結果を取得できませんでした' });
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [photos]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, retry: submit, cancel };
}

import { FORBIDDEN_PATTERNS } from './forbiddenPatterns';
import type { PhotoAssessmentApiResult } from '../api/photoAssessmentClient';

export const FALLBACK_ADVICE_MESSAGE = '改善提案を生成できませんでした';
export const FALLBACK_REASON_MESSAGE = '理由を生成できませんでした';

export function containsForbiddenPattern(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));
}

// AC-003/AC-004: 禁止パターンを含む理由・改善提案は画面に一切表示せず、
// 該当項目のみ置換する(部分表示せずエラー、とするAC-001の要素欠落エラーとは別ケース)。
export function sanitizePhotoAssessmentResult(
  result: PhotoAssessmentApiResult
): PhotoAssessmentApiResult {
  const filteredReasons = result.reasons.filter((reason) => !containsForbiddenPattern(reason));
  const reasons = filteredReasons.length > 0 ? filteredReasons : [FALLBACK_REASON_MESSAGE];

  const improvements = result.improvements.map((improvement) =>
    containsForbiddenPattern(improvement.advice)
      ? { ...improvement, advice: FALLBACK_ADVICE_MESSAGE }
      : improvement
  );

  return { ...result, reasons, improvements };
}

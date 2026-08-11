import type { ImprovementCategory } from '../../types/domain';
import { MalformedResponseError, ProxyRequestError, RateLimitedError } from './errors';

export { MalformedResponseError, ProxyRequestError, RateLimitedError };

// nobishiro-proxy(別リポジトリ)との暫定API契約。
// 実プロキシ実装時にこの契約に合わせる(2026-08-10 人間承認済み)。
export type SelectedPhoto = {
  uri: string;
  assetId: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type PhotoAssessmentApiResult = {
  score: number;
  reasons: string[];
  improvements: { category: ImprovementCategory; advice: string }[];
};

export type PhotoAssessmentExclusionReason = 'moderation' | 'no_person';

// AC-022/AC-024: entriesは送信した写真と同じ順序・同じ枚数で1件ずつ対応する。
// vision AIへの送信前にモデレーション判定(AC-022)を行い、送信後に人物検出可否(AC-024)を判定する
// という2段階の処理結果を、プロキシがこの1つのentry配列にまとめて返す暫定契約とする。
// モデレーション判定自体がエラーになった場合も、プロキシ側でreason:'moderation'として返す
// (fail-closed。クライアント側からは「判定を拒否された」場合と区別できない)。
export type PhotoAssessmentEntry =
  | ({ status: 'included' } & PhotoAssessmentApiResult)
  | { status: 'excluded'; reason: PhotoAssessmentExclusionReason };

export type PhotoAssessmentApiResponse = {
  // 少なくとも1件がincludedの場合のみ意味を持つ。全件excludedの場合は無視してよい
  recommendedIndex: number;
  entries: PhotoAssessmentEntry[];
};

const VALID_CATEGORIES: ImprovementCategory[] = [
  'light',
  'composition',
  'expression',
  'outfit',
  'background',
  'other',
];

const VALID_EXCLUSION_REASONS: PhotoAssessmentExclusionReason[] = ['moderation', 'no_person'];

// AC-001 失敗時(a): 判定結果のいずれかの要素が欠けたレスポンスは部分表示せずエラーにする
// AC-022/AC-024: バッチ内の除外(entries)自体はAC-001の要素欠落エラーとは別ケースとして扱う
export function validatePhotoAssessmentResponse(json: unknown): PhotoAssessmentApiResponse {
  if (typeof json !== 'object' || json === null) throw new MalformedResponseError();
  const body = json as Record<string, unknown>;

  if (typeof body.recommendedIndex !== 'number' || !Array.isArray(body.entries) || body.entries.length === 0) {
    throw new MalformedResponseError();
  }

  const entries = body.entries.map((rawEntry): PhotoAssessmentEntry => {
    if (typeof rawEntry !== 'object' || rawEntry === null) throw new MalformedResponseError();
    const entry = rawEntry as Record<string, unknown>;

    if (entry.status === 'excluded') {
      if (!VALID_EXCLUSION_REASONS.includes(entry.reason as PhotoAssessmentExclusionReason)) {
        throw new MalformedResponseError();
      }
      return { status: 'excluded', reason: entry.reason as PhotoAssessmentExclusionReason };
    }

    if (entry.status !== 'included') throw new MalformedResponseError();
    if (typeof entry.score !== 'number' || entry.score < 1 || entry.score > 5) {
      throw new MalformedResponseError();
    }
    if (!Array.isArray(entry.reasons) || entry.reasons.length === 0) {
      throw new MalformedResponseError();
    }
    if (!Array.isArray(entry.improvements) || entry.improvements.length === 0) {
      throw new MalformedResponseError();
    }

    const improvements = entry.improvements.map((rawImprovement) => {
      if (typeof rawImprovement !== 'object' || rawImprovement === null) throw new MalformedResponseError();
      const improvement = rawImprovement as Record<string, unknown>;
      if (
        typeof improvement.advice !== 'string' ||
        improvement.advice.length === 0 ||
        !VALID_CATEGORIES.includes(improvement.category as ImprovementCategory)
      ) {
        throw new MalformedResponseError();
      }
      return {
        category: improvement.category as ImprovementCategory,
        advice: improvement.advice,
      };
    });

    return {
      status: 'included',
      score: entry.score,
      reasons: entry.reasons as string[],
      improvements,
    };
  });

  // recommendedIndexは「少なくとも1件includedがある」場合のみ、includedなentryを指す必要がある。
  // 全件excludedの場合は上位層(usePhotoAssessmentSubmission)が全滅として扱うためここでは検証しない。
  const hasIncluded = entries.some((entry) => entry.status === 'included');
  if (hasIncluded) {
    const recommended = entries[body.recommendedIndex];
    if (!recommended || recommended.status !== 'included') {
      throw new MalformedResponseError();
    }
  }

  return { recommendedIndex: body.recommendedIndex, entries };
}

export async function assessPhotos(
  photos: SelectedPhoto[],
  signal: AbortSignal
): Promise<PhotoAssessmentApiResponse> {
  const baseUrl = process.env.EXPO_PUBLIC_PROXY_BASE_URL;
  const form = new FormData();
  photos.forEach((photo, index) => {
    form.append(
      'photos',
      {
        uri: photo.uri,
        name: photo.fileName ?? `photo-${index}.jpg`,
        type: photo.mimeType ?? 'image/jpeg',
      } as unknown as Blob
    );
  });

  const response = await fetch(`${baseUrl}/v1/photo-assessment`, {
    method: 'POST',
    body: form,
    signal,
  });

  // AC-023: レート制限超過はHTTP 429で通知される(専用エラーとして区別する)
  if (response.status === 429) {
    throw new RateLimitedError();
  }
  if (!response.ok) {
    throw new ProxyRequestError(response.status);
  }

  const json = await response.json();
  return validatePhotoAssessmentResponse(json);
}

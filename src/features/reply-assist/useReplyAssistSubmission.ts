import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ProxyRequestError,
  RateLimitedError,
  generateReplySuggestions,
  type ReplyAssistApiResponse,
  type ReplyAssistRequest,
} from '../../lib/api/replyAssistClient';
import { trackEvent } from '../../lib/analytics';
import { incrementQuota } from '../quota/quotaGate';
import { generateId } from '../../lib/id';
import { addReplySession } from '../../lib/storage';
import type { ReplySession } from '../../types/domain';

// spec.md AC-002と同様に60秒でタイムアウトとする(返信支援にも共通の性能目標として適用)
export const REQUEST_TIMEOUT_MS = 60_000;

export type ReplySubmissionPhase =
  | { status: 'pending' }
  | { status: 'success'; sessionId: string; suggestionCount: number }
  | { status: 'unreadable' }
  // AC-022(S-7): モデレーション判定で不適切と判定された。無料枠は消費しない
  | { status: 'guideline_violation' }
  // AC-023: プロキシのレート制限超過(HTTP 429)。無料枠は消費しない
  | { status: 'rate_limited' }
  | { status: 'timeout' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function buildReplySession(request: ReplyAssistRequest, response: Extract<ReplyAssistApiResponse, { status: 'ok' }>): ReplySession {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    inputType: request.inputType,
    // 7章: テキスト入力はユーザー入力そのもの、スクショ入力はAIが抽出した会話要約を保存する
    inputText: request.inputType === 'text' ? request.text : response.conversationSummary ?? '',
    tone: request.tone,
    suggestions: response.suggestions,
  };
}

export function useReplyAssistSubmission(request: ReplyAssistRequest | null, options?: { consumesQuota?: boolean }) {
  const consumesQuota = options?.consumesQuota ?? true;
  const [phase, setPhase] = useState<ReplySubmissionPhase>({ status: 'pending' });
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // AC-006(DL-008): 再生成では無料枠を追加消費しない。このセッションで未消費の場合のみ1回消費する。
  const quotaConsumedRef = useRef(false);

  const submit = useCallback(async () => {
    if (!request) return;
    cancelledRef.current = false;
    setPhase({ status: 'pending' });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await generateReplySuggestions(request, controller.signal);
      if (response.status === 'unreadable') {
        // AC-008: 会話を読み取れない場合は無料枠を消費しない(呼び出し側でquota操作をしない)
        setPhase({ status: 'unreadable' });
        return;
      }
      if (response.status === 'moderation_rejected') {
        // AC-022(S-7): 不適切と判定された場合は返信案生成を行わず、無料枠も消費しない
        setPhase({ status: 'guideline_violation' });
        return;
      }
      const session = buildReplySession(request, response);
      await addReplySession(session);
      if (consumesQuota && !quotaConsumedRef.current) {
        await incrementQuota('replyGenerations');
        quotaConsumedRef.current = true;
      }
      // AC-015: reply_generated(inputTypeをプロパティに含む)
      trackEvent({ name: 'reply_generated', properties: { inputType: request.inputType } });
      setPhase({ status: 'success', sessionId: session.id, suggestionCount: session.suggestions.length });
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
        setPhase({ status: 'error', message: '返信案を取得できませんでした' });
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [request]);

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

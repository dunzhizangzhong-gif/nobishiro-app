import { MalformedResponseError, ProxyRequestError, RateLimitedError } from './errors';
import type { ReplySuggestion, ReplyTone } from '../../types/domain';

export { MalformedResponseError, ProxyRequestError, RateLimitedError };

// nobishiro-proxy(別リポジトリ)との暫定API契約。
// 実プロキシ実装時にこの契約に合わせる(2026-08-10 人間承認済みの方針を踏襲)。
export type ReplyAssistTextRequest = {
  inputType: 'text';
  text: string;
  tone: ReplyTone;
};

export type ReplyAssistScreenshotRequest = {
  inputType: 'screenshot';
  screenshot: { uri: string; fileName?: string | null; mimeType?: string | null };
  tone: ReplyTone;
};

export type ReplyAssistRequest = ReplyAssistTextRequest | ReplyAssistScreenshotRequest;

// AC-008: スクショから会話を抽出できない場合、プロキシは 'unreadable' を返す設計
// (プロンプトで指定のエラー形式を返すよう指示する。パース処理はこの関数が担う)
// AC-022: vision AIへの送信前にモデレーション判定を行い、不適切と判定した場合(判定自体の
// エラーを含むfail-closed)は 'moderation_rejected' を返す(vision APIへは送信しない)
export type ReplyAssistApiResponse =
  | { status: 'ok'; suggestions: ReplySuggestion[]; conversationSummary?: string }
  | { status: 'unreadable' }
  | { status: 'moderation_rejected' };

export function validateReplyAssistResponse(json: unknown): ReplyAssistApiResponse {
  if (typeof json !== 'object' || json === null) throw new MalformedResponseError();
  const body = json as Record<string, unknown>;

  if (body.status === 'unreadable') {
    return { status: 'unreadable' };
  }

  if (body.status === 'moderation_rejected') {
    return { status: 'moderation_rejected' };
  }

  if (body.status !== 'ok' || !Array.isArray(body.suggestions)) {
    throw new MalformedResponseError();
  }

  const suggestions = body.suggestions.map((raw): ReplySuggestion => {
    if (typeof raw !== 'object' || raw === null) throw new MalformedResponseError();
    const suggestion = raw as Record<string, unknown>;
    if (
      typeof suggestion.text !== 'string' ||
      suggestion.text.length === 0 ||
      typeof suggestion.aim !== 'string' ||
      suggestion.aim.length === 0
    ) {
      throw new MalformedResponseError();
    }
    return { text: suggestion.text, aim: suggestion.aim };
  });

  if (body.conversationSummary !== undefined && typeof body.conversationSummary !== 'string') {
    throw new MalformedResponseError();
  }

  return {
    status: 'ok',
    suggestions,
    conversationSummary: body.conversationSummary as string | undefined,
  };
}

export async function generateReplySuggestions(
  request: ReplyAssistRequest,
  signal: AbortSignal
): Promise<ReplyAssistApiResponse> {
  const baseUrl = process.env.EXPO_PUBLIC_PROXY_BASE_URL;
  let response: Response;

  if (request.inputType === 'text') {
    response = await fetch(`${baseUrl}/v1/reply-assist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputType: 'text', text: request.text, tone: request.tone }),
      signal,
    });
  } else {
    const form = new FormData();
    form.append('inputType', 'screenshot');
    if (request.tone) form.append('tone', request.tone);
    form.append(
      'screenshot',
      {
        uri: request.screenshot.uri,
        name: request.screenshot.fileName ?? 'screenshot.jpg',
        type: request.screenshot.mimeType ?? 'image/jpeg',
      } as unknown as Blob
    );
    response = await fetch(`${baseUrl}/v1/reply-assist`, {
      method: 'POST',
      body: form,
      signal,
    });
  }

  // AC-023: レート制限超過はHTTP 429で通知される(専用エラーとして区別する)
  if (response.status === 429) {
    throw new RateLimitedError();
  }
  if (!response.ok) {
    throw new ProxyRequestError(response.status);
  }

  const json = await response.json();
  return validateReplyAssistResponse(json);
}

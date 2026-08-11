import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ProxyRequestError, RateLimitedError } from '../../lib/api/replyAssistClient';

const mockGenerateReplySuggestions = jest.fn();
const mockAddReplySession = jest.fn();

jest.mock('../../lib/api/replyAssistClient', () => {
  const actual = jest.requireActual('../../lib/api/replyAssistClient');
  return {
    ...actual,
    generateReplySuggestions: (...args: unknown[]) => mockGenerateReplySuggestions(...args),
  };
});

jest.mock('../../lib/storage', () => ({
  addReplySession: (...args: unknown[]) => mockAddReplySession(...args),
}));

const mockIncrementQuota = jest.fn();
jest.mock('../quota/quotaGate', () => ({
  incrementQuota: (...args: unknown[]) => mockIncrementQuota(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { REQUEST_TIMEOUT_MS, useReplyAssistSubmission } from './useReplyAssistSubmission';

const textRequest = { inputType: 'text' as const, text: 'こんにちは', tone: 'casual' as const };
const screenshotRequest = {
  inputType: 'screenshot' as const,
  screenshot: { uri: 'file:///tmp/s.jpg', fileName: 's.jpg', mimeType: 'image/jpeg' },
  tone: null,
};
const validOkResponse = {
  status: 'ok' as const,
  suggestions: [
    { text: 'こんにちは!', aim: '親しみやすさ' },
    { text: 'はじめまして', aim: '丁寧さ' },
  ],
};

beforeEach(() => {
  mockGenerateReplySuggestions.mockReset();
  mockAddReplySession.mockReset();
  mockIncrementQuota.mockReset();
  mockIncrementQuota.mockResolvedValue(undefined);
  mockTrackEvent.mockReset();
});

describe('useReplyAssistSubmission (AC-006/AC-007成功時の保存/AC-008読み取り不能/AC-002タイムアウト)', () => {
  it('on success with a text request, saves the session using the user input as inputText', async () => {
    mockGenerateReplySuggestions.mockResolvedValue(validOkResponse);
    mockAddReplySession.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockAddReplySession).toHaveBeenCalledTimes(1);
    const saved = mockAddReplySession.mock.calls[0][0];
    expect(saved.inputType).toBe('text');
    expect(saved.inputText).toBe('こんにちは');
    expect(saved.tone).toBe('casual');
    expect(saved.suggestions).toHaveLength(2);
    if (result.current.phase.status === 'success') {
      expect(result.current.phase.suggestionCount).toBe(2);
    }
  });

  it('on success with a screenshot request, saves the AI-extracted conversationSummary as inputText', async () => {
    mockGenerateReplySuggestions.mockResolvedValue({
      ...validOkResponse,
      conversationSummary: '相手: 今度ご飯行きませんか?',
    });
    mockAddReplySession.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useReplyAssistSubmission(screenshotRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    const saved = mockAddReplySession.mock.calls[0][0];
    expect(saved.inputType).toBe('screenshot');
    expect(saved.inputText).toBe('相手: 今度ご飯行きませんか?');
  });

  it('AC-006 失敗時: saves fewer than 3 suggestions as-is (regenerate UI handled by the result screen)', async () => {
    mockGenerateReplySuggestions.mockResolvedValue({
      status: 'ok',
      suggestions: [{ text: 'こんにちは!', aim: '親しみやすさ' }],
    });
    mockAddReplySession.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    if (result.current.phase.status === 'success') {
      expect(result.current.phase.suggestionCount).toBe(1);
    }
  });

  it('AC-009: increments the replyGenerations quota exactly once on the initial success', async () => {
    mockGenerateReplySuggestions.mockResolvedValue(validOkResponse);
    mockAddReplySession.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockIncrementQuota).toHaveBeenCalledTimes(1);
    expect(mockIncrementQuota).toHaveBeenCalledWith('replyGenerations');
  });

  it('DL-008: regenerating via retry() after a <3-suggestion success does not consume quota again', async () => {
    mockGenerateReplySuggestions.mockResolvedValue({
      status: 'ok',
      suggestions: [{ text: 'こんにちは!', aim: '親しみやすさ' }],
    });
    mockAddReplySession.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));
    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockIncrementQuota).toHaveBeenCalledTimes(1);

    mockGenerateReplySuggestions.mockResolvedValue(validOkResponse);
    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() =>
      expect(result.current.phase.status === 'success' && result.current.phase.suggestionCount).toBe(2)
    );
    expect(mockIncrementQuota).toHaveBeenCalledTimes(1);
  });

  it('AC-011: does not consume quota when consumesQuota is false (Pro状態)', async () => {
    mockGenerateReplySuggestions.mockResolvedValue(validOkResponse);
    mockAddReplySession.mockResolvedValue(undefined);

    const { result } = await renderHook(() =>
      useReplyAssistSubmission(textRequest, { consumesQuota: false })
    );

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-008: reports "unreadable" and does not save a session when the screenshot cannot be read', async () => {
    mockGenerateReplySuggestions.mockResolvedValue({ status: 'unreadable' });

    const { result } = await renderHook(() => useReplyAssistSubmission(screenshotRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('unreadable'));
    expect(mockAddReplySession).not.toHaveBeenCalled();
  });

  it('AC-002: aborts and reports timeout when no response arrives within 60s', async () => {
    jest.useFakeTimers();
    mockGenerateReplySuggestions.mockImplementation(
      (_req: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));
    await act(async () => {
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
    });

    await waitFor(() => expect(result.current.phase.status).toBe('timeout'));
    expect(mockAddReplySession).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('DL-010パターン: cancel() aborts the in-flight request and reports cancelled', async () => {
    mockGenerateReplySuggestions.mockImplementation(
      (_req: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));
    await act(async () => {
      result.current.cancel();
    });

    await waitFor(() => expect(result.current.phase.status).toBe('cancelled'));
    expect(mockAddReplySession).not.toHaveBeenCalled();
  });

  it('maps a non-2xx proxy response to a generic error phase', async () => {
    mockGenerateReplySuggestions.mockRejectedValue(new ProxyRequestError(500));

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('error'));
    expect(mockAddReplySession).not.toHaveBeenCalled();
  });

  it('AC-022(S-7): reports guideline_violation and consumes no quota when moderation rejects the screenshot', async () => {
    mockGenerateReplySuggestions.mockResolvedValue({ status: 'moderation_rejected' });

    const { result } = await renderHook(() => useReplyAssistSubmission(screenshotRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('guideline_violation'));
    expect(mockAddReplySession).not.toHaveBeenCalled();
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-023: reports rate_limited and consumes no quota on HTTP 429', async () => {
    mockGenerateReplySuggestions.mockRejectedValue(new RateLimitedError());

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('rate_limited'));
    expect(mockAddReplySession).not.toHaveBeenCalled();
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-023 失敗時: a rate-limiting mechanism failure (non-429 proxy error) fails closed as a generic error, not open', async () => {
    mockGenerateReplySuggestions.mockRejectedValue(new ProxyRequestError(503));

    const { result } = await renderHook(() => useReplyAssistSubmission(textRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('error'));
    expect(mockAddReplySession).not.toHaveBeenCalled();
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-015: fires reply_generated with the request inputType on success', async () => {
    mockGenerateReplySuggestions.mockResolvedValue(validOkResponse);
    mockAddReplySession.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useReplyAssistSubmission(screenshotRequest));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'reply_generated',
      properties: { inputType: 'screenshot' },
    });
  });
});

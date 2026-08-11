import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ProxyRequestError, RateLimitedError } from '../../lib/api/photoAssessmentClient';

const mockAssessPhotos = jest.fn();
const mockAddAssessment = jest.fn();

jest.mock('../../lib/api/photoAssessmentClient', () => {
  const actual = jest.requireActual('../../lib/api/photoAssessmentClient');
  return {
    ...actual,
    assessPhotos: (...args: unknown[]) => mockAssessPhotos(...args),
  };
});

jest.mock('../../lib/storage', () => ({
  addAssessment: (...args: unknown[]) => mockAddAssessment(...args),
}));

const mockIncrementQuota = jest.fn();
jest.mock('../quota/quotaGate', () => ({
  incrementQuota: (...args: unknown[]) => mockIncrementQuota(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { REQUEST_TIMEOUT_MS, usePhotoAssessmentSubmission } from './usePhotoAssessmentSubmission';

const photo = { uri: 'file:///tmp/a.jpg', assetId: 'asset-1', fileName: 'a.jpg', mimeType: 'image/jpeg' };
const includedEntry = {
  status: 'included' as const,
  score: 4,
  reasons: ['x'],
  improvements: [{ category: 'light' as const, advice: 'y' }],
};
const validResponse = {
  recommendedIndex: 0,
  entries: [includedEntry],
};

beforeEach(() => {
  mockAssessPhotos.mockReset();
  mockAddAssessment.mockReset();
  mockIncrementQuota.mockReset();
  mockIncrementQuota.mockResolvedValue(undefined);
  mockTrackEvent.mockReset();
});

describe('usePhotoAssessmentSubmission (AC-001成功時の保存/AC-002タイムアウト/DL-010キャンセル)', () => {
  it('on success, saves the assessment to history and reports the assessment id', async () => {
    mockAssessPhotos.mockResolvedValue(validResponse);
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockAddAssessment).toHaveBeenCalledTimes(1);
    const savedAssessment = mockAddAssessment.mock.calls[0][0];
    expect(savedAssessment.photoRefs).toEqual(['asset-1']);
    expect(savedAssessment.recommendedIndex).toBe(0);
    if (result.current.phase.status === 'success') {
      expect(result.current.phase.assessmentId).toBe(savedAssessment.id);
    }
  });

  it('AC-009: increments the photoAssessments quota exactly once on success', async () => {
    mockAssessPhotos.mockResolvedValue(validResponse);
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockIncrementQuota).toHaveBeenCalledTimes(1);
    expect(mockIncrementQuota).toHaveBeenCalledWith('photoAssessments');
  });

  it('AC-011: does not consume quota when consumesQuota is false (Pro状態)', async () => {
    mockAssessPhotos.mockResolvedValue(validResponse);
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() =>
      usePhotoAssessmentSubmission([photo], { consumesQuota: false })
    );

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-003/AC-004: filters forbidden text out of the saved assessment', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 0,
      entries: [
        {
          status: 'included',
          score: 4,
          reasons: ['自然光が良い', 'Tinderの統計でも人気です'],
          improvements: [{ category: 'light', advice: '痩せて見える角度で撮ると良い' }],
        },
      ],
    });
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    const savedAssessment = mockAddAssessment.mock.calls[0][0];
    expect(savedAssessment.results[0].reasons).toEqual(['自然光が良い']);
    expect(savedAssessment.results[0].improvements[0].advice).toBe('改善提案を生成できませんでした');
  });

  it('AC-002: aborts and reports timeout when no response arrives within 60s', async () => {
    jest.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    mockAssessPhotos.mockImplementation(
      (_photos: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          capturedSignal = signal;
          signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));
    expect(result.current.phase.status).toBe('pending');

    await act(async () => {
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
    });

    await waitFor(() => expect(result.current.phase.status).toBe('timeout'));
    expect(capturedSignal?.aborted).toBe(true);
    expect(mockAddAssessment).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('AC-002: retry re-invokes the request and can succeed after a prior timeout', async () => {
    jest.useFakeTimers();
    mockAssessPhotos.mockImplementationOnce(
      (_photos: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    mockAssessPhotos.mockResolvedValueOnce(validResponse);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));
    await act(async () => {
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
    });
    await waitFor(() => expect(result.current.phase.status).toBe('timeout'));
    jest.useRealTimers();

    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockAssessPhotos).toHaveBeenCalledTimes(2);
    // AC-002: 失敗した最初の試行では消費されず、成功した再試行でのみ1回消費される
    expect(mockIncrementQuota).toHaveBeenCalledTimes(1);
  });

  it('DL-010: cancel() aborts the in-flight request and reports cancelled (not timeout/error)', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockAssessPhotos.mockImplementation(
      (_photos: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          capturedSignal = signal;
          signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await act(async () => {
      result.current.cancel();
    });

    await waitFor(() => expect(result.current.phase.status).toBe('cancelled'));
    expect(capturedSignal?.aborted).toBe(true);
    expect(mockAddAssessment).not.toHaveBeenCalled();
  });

  it('maps a non-2xx proxy response to a generic error phase (part of AC-001 失敗時(a))', async () => {
    mockAssessPhotos.mockRejectedValue(new ProxyRequestError(500));

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('error'));
    expect(mockAddAssessment).not.toHaveBeenCalled();
  });

  it('maps a malformed response to a generic error phase without partial display (AC-001 失敗時(a))', async () => {
    mockAssessPhotos.mockRejectedValue(new Error('malformed_response'));

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('error'));
    expect(mockAddAssessment).not.toHaveBeenCalled();
  });

  it('AC-015: fires photo_submitted on send and assessment_completed (with durationSeconds) on success', async () => {
    mockAssessPhotos.mockResolvedValue(validResponse);
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'photo_submitted' });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'assessment_completed',
      properties: { durationSeconds: expect.any(Number) },
    });
  });
});

describe('usePhotoAssessmentSubmission (AC-022モデレーション/AC-024人物検出/AC-023レート制限)', () => {
  const photo2 = { uri: 'file:///tmp/b.jpg', assetId: 'asset-2', fileName: 'b.jpg', mimeType: 'image/jpeg' };

  it('AC-022: excludes the moderation-rejected photo and judges the remaining one, remapping recommendedIndex and photoRefs', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 1,
      entries: [{ status: 'excluded', reason: 'moderation' }, includedEntry],
    });
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo, photo2]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    const savedAssessment = mockAddAssessment.mock.calls[0][0];
    expect(savedAssessment.photoRefs).toEqual(['asset-2']);
    expect(savedAssessment.results).toHaveLength(1);
    expect(savedAssessment.recommendedIndex).toBe(0);
    expect(savedAssessment.excludedCount).toBe(1);
  });

  it('AC-022: reports guideline_violation and consumes no quota when the whole batch is excluded by moderation', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 0,
      entries: [
        { status: 'excluded', reason: 'moderation' },
        { status: 'excluded', reason: 'moderation' },
      ],
    });

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo, photo2]));

    await waitFor(() => expect(result.current.phase.status).toBe('guideline_violation'));
    expect(mockAddAssessment).not.toHaveBeenCalled();
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-022: a partial exclusion still consumes the quota exactly once', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 1,
      entries: [{ status: 'excluded', reason: 'moderation' }, includedEntry],
    });
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo, photo2]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockIncrementQuota).toHaveBeenCalledTimes(1);
    expect(mockIncrementQuota).toHaveBeenCalledWith('photoAssessments');
  });

  it('AC-024: excludes the no-person photo and judges the remaining one', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 0,
      entries: [includedEntry, { status: 'excluded', reason: 'no_person' }],
    });
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo, photo2]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    const savedAssessment = mockAddAssessment.mock.calls[0][0];
    expect(savedAssessment.photoRefs).toEqual(['asset-1']);
    expect(savedAssessment.excludedCount).toBe(1);
  });

  it('AC-024: reports no_person_detected and consumes no quota when the whole batch has no detectable person', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 0,
      entries: [
        { status: 'excluded', reason: 'no_person' },
        { status: 'excluded', reason: 'no_person' },
      ],
    });

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo, photo2]));

    await waitFor(() => expect(result.current.phase.status).toBe('no_person_detected'));
    expect(mockAddAssessment).not.toHaveBeenCalled();
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-024: a partial exclusion still consumes the quota exactly once', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 0,
      entries: [includedEntry, { status: 'excluded', reason: 'no_person' }],
    });
    mockAddAssessment.mockResolvedValue(undefined);

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo, photo2]));

    await waitFor(() => expect(result.current.phase.status).toBe('success'));
    expect(mockIncrementQuota).toHaveBeenCalledTimes(1);
  });

  it('AC-022/AC-024: when a fully-excluded batch mixes both reasons, the guideline-violation screen takes precedence', async () => {
    mockAssessPhotos.mockResolvedValue({
      recommendedIndex: 0,
      entries: [
        { status: 'excluded', reason: 'no_person' },
        { status: 'excluded', reason: 'moderation' },
      ],
    });

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo, photo2]));

    await waitFor(() => expect(result.current.phase.status).toBe('guideline_violation'));
  });

  it('AC-023: reports rate_limited and consumes no quota on HTTP 429', async () => {
    mockAssessPhotos.mockRejectedValue(new RateLimitedError());

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('rate_limited'));
    expect(mockAddAssessment).not.toHaveBeenCalled();
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });

  it('AC-023 失敗時: a rate-limiting mechanism failure (non-429 proxy error) fails closed as a generic error, not open', async () => {
    mockAssessPhotos.mockRejectedValue(new ProxyRequestError(503));

    const { result } = await renderHook(() => usePhotoAssessmentSubmission([photo]));

    await waitFor(() => expect(result.current.phase.status).toBe('error'));
    expect(mockAddAssessment).not.toHaveBeenCalled();
    expect(mockIncrementQuota).not.toHaveBeenCalled();
  });
});

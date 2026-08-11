import {
  MalformedResponseError,
  ProxyRequestError,
  RateLimitedError,
  assessPhotos,
  validatePhotoAssessmentResponse,
} from './photoAssessmentClient';

const validResponse = {
  recommendedIndex: 0,
  entries: [
    {
      status: 'included',
      score: 4,
      reasons: ['自然光が良い'],
      improvements: [{ category: 'light', advice: '窓際で撮ると良い' }],
    },
    {
      status: 'included',
      score: 3,
      reasons: ['表情が硬い'],
      improvements: [{ category: 'expression', advice: '口角を上げて撮ると良い' }],
    },
  ],
};

describe('validatePhotoAssessmentResponse (AC-001 失敗時(a) / AC-022 / AC-024)', () => {
  it('accepts a well-formed response', () => {
    expect(validatePhotoAssessmentResponse(validResponse)).toEqual(validResponse);
  });

  it('AC-022: accepts a partial-exclusion response (moderation) with recommendedIndex pointing to the included entry', () => {
    const response = {
      recommendedIndex: 1,
      entries: [{ status: 'excluded', reason: 'moderation' }, validResponse.entries[0]],
    };
    expect(validatePhotoAssessmentResponse(response)).toEqual(response);
  });

  it('AC-024: accepts a partial-exclusion response (no_person)', () => {
    const response = {
      recommendedIndex: 0,
      entries: [validResponse.entries[0], { status: 'excluded', reason: 'no_person' }],
    };
    expect(validatePhotoAssessmentResponse(response)).toEqual(response);
  });

  it('AC-022/AC-024: accepts a fully-excluded (全滅) response without validating recommendedIndex', () => {
    const response = {
      recommendedIndex: 0,
      entries: [
        { status: 'excluded', reason: 'moderation' },
        { status: 'excluded', reason: 'no_person' },
      ],
    };
    expect(validatePhotoAssessmentResponse(response)).toEqual(response);
  });

  it.each([
    ['not an object', null],
    ['missing recommendedIndex', { entries: validResponse.entries }],
    ['entries not an array', { recommendedIndex: 0, entries: 'x' }],
    ['empty entries array', { recommendedIndex: 0, entries: [] }],
    [
      'recommendedIndex pointing to an excluded entry (mismatched contract)',
      {
        recommendedIndex: 0,
        entries: [{ status: 'excluded', reason: 'moderation' }, validResponse.entries[0]],
      },
    ],
    [
      'an excluded entry with an invalid reason',
      { recommendedIndex: 0, entries: [{ status: 'excluded', reason: 'weight' }] },
    ],
    [
      'an entry with neither included nor excluded status',
      { recommendedIndex: 0, entries: [{ status: 'pending' }] },
    ],
    [
      'an included entry missing reasons',
      {
        recommendedIndex: 0,
        entries: [{ status: 'included', score: 3, reasons: [], improvements: validResponse.entries[0].improvements }],
      },
    ],
    [
      'an included entry missing improvements',
      {
        recommendedIndex: 0,
        entries: [{ status: 'included', score: 3, reasons: ['x'], improvements: [] }],
      },
    ],
    [
      'an included entry with an out-of-range score',
      {
        recommendedIndex: 0,
        entries: [{ status: 'included', score: 6, reasons: ['x'], improvements: validResponse.entries[0].improvements }],
      },
    ],
    [
      'an improvement with an invalid category',
      {
        recommendedIndex: 0,
        entries: [{ status: 'included', score: 3, reasons: ['x'], improvements: [{ category: 'weight', advice: 'x' }] }],
      },
    ],
  ])('rejects a response %s', (_label, malformed) => {
    expect(() => validatePhotoAssessmentResponse(malformed)).toThrow(MalformedResponseError);
  });
});

describe('assessPhotos', () => {
  const photo = { uri: 'file:///tmp/a.jpg', assetId: 'asset-1', fileName: 'a.jpg', mimeType: 'image/jpeg' };

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('returns the validated response on success', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validResponse,
    });

    const result = await assessPhotos([photo], new AbortController().signal);
    expect(result).toEqual(validResponse);
  });

  it('throws ProxyRequestError on a non-2xx response', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(assessPhotos([photo], new AbortController().signal)).rejects.toThrow(ProxyRequestError);
  });

  it('AC-023: throws RateLimitedError on an HTTP 429 response, distinct from generic proxy errors', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });

    await expect(assessPhotos([photo], new AbortController().signal)).rejects.toThrow(RateLimitedError);
  });

  it('propagates abort errors (used for timeout/cancel handling upstream)', async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(assessPhotos([photo], new AbortController().signal)).rejects.toThrow('Aborted');
  });
});

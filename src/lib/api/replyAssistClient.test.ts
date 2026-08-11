import {
  MalformedResponseError,
  ProxyRequestError,
  RateLimitedError,
  generateReplySuggestions,
  validateReplyAssistResponse,
} from './replyAssistClient';

const validOkResponse = {
  status: 'ok',
  suggestions: [
    { text: 'こんにちは!', aim: '親しみやすさ' },
    { text: 'はじめまして。よろしくお願いします', aim: '丁寧さ' },
  ],
};

describe('validateReplyAssistResponse', () => {
  it('accepts a well-formed ok response', () => {
    expect(validateReplyAssistResponse(validOkResponse)).toEqual(validOkResponse);
  });

  it('accepts an "unreadable" response (AC-008)', () => {
    expect(validateReplyAssistResponse({ status: 'unreadable' })).toEqual({ status: 'unreadable' });
  });

  it('accepts a "moderation_rejected" response (AC-022 S-7)', () => {
    expect(validateReplyAssistResponse({ status: 'moderation_rejected' })).toEqual({
      status: 'moderation_rejected',
    });
  });

  it('accepts a well-formed ok response with a conversationSummary (screenshot path)', () => {
    const response = { ...validOkResponse, conversationSummary: '相手: 今度ご飯行きませんか?' };
    expect(validateReplyAssistResponse(response)).toEqual(response);
  });

  it.each([
    ['not an object', null],
    ['missing status', { suggestions: validOkResponse.suggestions }],
    ['suggestions not an array', { status: 'ok', suggestions: 'x' }],
    ['a suggestion missing aim', { status: 'ok', suggestions: [{ text: 'x' }] }],
    ['a suggestion missing text', { status: 'ok', suggestions: [{ aim: 'x' }] }],
    ['a non-string conversationSummary', { ...validOkResponse, conversationSummary: 123 }],
  ])('rejects a response %s', (_label, malformed) => {
    expect(() => validateReplyAssistResponse(malformed)).toThrow(MalformedResponseError);
  });

  it('accepts an empty suggestions array (AC-006 失敗時: 3件未満は上位で処理)', () => {
    expect(validateReplyAssistResponse({ status: 'ok', suggestions: [] })).toEqual({
      status: 'ok',
      suggestions: [],
      conversationSummary: undefined,
    });
  });
});

describe('generateReplySuggestions', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('sends a JSON body for text input and returns the validated response', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => validOkResponse });

    const result = await generateReplySuggestions(
      { inputType: 'text', text: 'こんにちは', tone: 'casual' },
      new AbortController().signal
    );

    expect(result).toEqual(validOkResponse);
    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ inputType: 'text', text: 'こんにちは', tone: 'casual' });
  });

  it('sends a multipart body for screenshot input', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => validOkResponse });

    await generateReplySuggestions(
      {
        inputType: 'screenshot',
        screenshot: { uri: 'file:///tmp/s.jpg', fileName: 's.jpg', mimeType: 'image/jpeg' },
        tone: null,
      },
      new AbortController().signal
    );

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('throws ProxyRequestError on a non-2xx response', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(
      generateReplySuggestions({ inputType: 'text', text: 'x', tone: null }, new AbortController().signal)
    ).rejects.toThrow(ProxyRequestError);
  });

  it('AC-023: throws RateLimitedError on an HTTP 429 response, distinct from generic proxy errors', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });

    await expect(
      generateReplySuggestions({ inputType: 'text', text: 'x', tone: null }, new AbortController().signal)
    ).rejects.toThrow(RateLimitedError);
  });
});

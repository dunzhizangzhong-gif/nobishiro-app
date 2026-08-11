import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

const mockSetStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

let mockPendingRequest: unknown = { inputType: 'text', text: 'こんにちは', tone: null };
jest.mock('../../../src/features/reply-assist/ReplyAssistSessionContext', () => ({
  useReplyAssistSession: () => ({ pendingRequest: mockPendingRequest }),
}));

const mockCancel = jest.fn();
const mockRetry = jest.fn();
let mockPhase: unknown = { status: 'pending' };
jest.mock('../../../src/features/reply-assist/useReplyAssistSubmission', () => ({
  useReplyAssistSubmission: () => ({ phase: mockPhase, retry: mockRetry, cancel: mockCancel }),
}));

const mockGetReplySessions = jest.fn();
jest.mock('../../../src/lib/storage', () => ({
  getReplySessions: (...args: unknown[]) => mockGetReplySessions(...args),
}));

jest.mock('../../../src/features/paywall/useEntitlement', () => ({
  useEntitlement: () => ({ isPro: false, isLoading: false, refresh: jest.fn() }),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../../src/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import ReplyAssistResult from '../../../app/reply-assist/result';

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockReplace.mockReset();
  mockParams = {};
  mockSetStringAsync.mockReset();
  mockCancel.mockReset();
  mockRetry.mockReset();
  mockGetReplySessions.mockReset();
  mockPendingRequest = { inputType: 'text', text: 'こんにちは', tone: null };
  mockTrackEvent.mockReset();
});

describe('ReplyAssistResult (AC-006結果表示・コピー・再生成)', () => {
  it('shows the processing view while pending, and cancel() + back() on cancel', async () => {
    mockPhase = { status: 'pending' };
    const screen = await render(<ReplyAssistResult />);

    expect(screen.getByTestId('reply-result-processing')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reply-result-cancel'));

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('AC-006: shows 3 suggestions with aim + copy button, no regenerate button', async () => {
    mockPhase = { status: 'success', sessionId: 's1', suggestionCount: 3 };
    mockGetReplySessions.mockResolvedValue([
      {
        status: 'ok',
        data: {
          id: 's1',
          createdAt: '2026-08-10T00:00:00.000Z',
          inputType: 'text',
          inputText: 'こんにちは',
          tone: null,
          suggestions: [
            { text: 'こんにちは!', aim: '親しみやすさ' },
            { text: 'はじめまして', aim: '丁寧さ' },
            { text: 'よろしくお願いします', aim: '誠実さ' },
          ],
        },
      },
    ]);

    const screen = await render(<ReplyAssistResult />);

    await waitFor(() => expect(screen.getByTestId('reply-result-card-2')).toBeTruthy());
    expect(screen.getByTestId('reply-result-aim-0').props.children).toBe('親しみやすさ');
    expect(screen.getByTestId('reply-result-text-0').props.children).toBe('こんにちは!');
    expect(screen.queryByTestId('reply-result-regenerate')).toBeNull();
  });

  it('AC-012: history view mode (id param) loads the persisted session without triggering a submission', async () => {
    mockParams = { id: 's3' };
    mockGetReplySessions.mockResolvedValue([
      {
        status: 'ok',
        data: {
          id: 's3',
          createdAt: '2026-08-10T00:00:00.000Z',
          inputType: 'text',
          inputText: 'こんにちは',
          tone: null,
          suggestions: [{ text: 'こんにちは!', aim: '親しみやすさ' }],
        },
      },
    ]);

    const screen = await render(<ReplyAssistResult />);

    await waitFor(() => expect(screen.getByTestId('reply-result-card-0')).toBeTruthy());
    // 履歴表示では件数不足でも再生成ボタンを出さない(送信フックを起動しないため再試行対象がない)
    expect(screen.queryByTestId('reply-result-regenerate')).toBeNull();
  });

  it('copy button copies the suggestion text to the clipboard and updates its label', async () => {
    mockPhase = { status: 'success', sessionId: 's1', suggestionCount: 1 };
    mockGetReplySessions.mockResolvedValue([
      {
        status: 'ok',
        data: {
          id: 's1',
          createdAt: '2026-08-10T00:00:00.000Z',
          inputType: 'text',
          inputText: 'こんにちは',
          tone: null,
          suggestions: [{ text: 'こんにちは!', aim: '親しみやすさ' }],
        },
      },
    ]);
    mockSetStringAsync.mockResolvedValue(true);

    const screen = await render(<ReplyAssistResult />);
    await waitFor(() => expect(screen.getByTestId('reply-result-card-0')).toBeTruthy());

    fireEvent.press(screen.getByTestId('reply-result-copy-0'));

    await waitFor(() => expect(mockSetStringAsync).toHaveBeenCalledWith('こんにちは!'));
    await waitFor(() => expect(screen.getByText('コピーしました')).toBeTruthy());
    // AC-015: reply_copied
    expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'reply_copied' });
  });

  it('AC-006 失敗時: shows a regenerate button when fewer than 3 suggestions were generated, and it calls retry()', async () => {
    mockPhase = { status: 'success', sessionId: 's2', suggestionCount: 2 };
    mockGetReplySessions.mockResolvedValue([
      {
        status: 'ok',
        data: {
          id: 's2',
          createdAt: '2026-08-10T00:00:00.000Z',
          inputType: 'text',
          inputText: 'こんにちは',
          tone: null,
          suggestions: [
            { text: 'こんにちは!', aim: '親しみやすさ' },
            { text: 'はじめまして', aim: '丁寧さ' },
          ],
        },
      },
    ]);

    const screen = await render(<ReplyAssistResult />);
    await waitFor(() => expect(screen.getByTestId('reply-result-regenerate')).toBeTruthy());

    fireEvent.press(screen.getByTestId('reply-result-regenerate'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('AC-008: shows the unreadable message and navigates to the input screen (text tab is the default)', async () => {
    mockPhase = { status: 'unreadable' };
    const screen = await render(<ReplyAssistResult />);

    expect(screen.getByTestId('reply-result-unreadable')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reply-result-go-to-text'));

    expect(mockReplace).toHaveBeenCalledWith('/reply-assist/input');
  });

  it('AC-002: shows a retry button on timeout, and it calls retry()', async () => {
    mockPhase = { status: 'timeout' };
    const screen = await render(<ReplyAssistResult />);

    expect(screen.getByTestId('reply-result-error-message')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reply-result-retry'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a generic error message', async () => {
    mockPhase = { status: 'error', message: '通信エラーが発生しました' };
    const screen = await render(<ReplyAssistResult />);

    expect(screen.getByTestId('reply-result-error-message').props.children).toBe('通信エラーが発生しました');
  });

  it('AC-023: shows the rate-limited message and a back button', async () => {
    mockPhase = { status: 'rate_limited' };
    const screen = await render(<ReplyAssistResult />);

    expect(screen.getByTestId('reply-result-rate-limited').props.children).toBe(
      'アクセスが集中しています。しばらくしてから再度お試しください'
    );
    fireEvent.press(screen.getByTestId('reply-result-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('AC-022(S-7): shows the guideline-violation message when the screenshot is rejected by moderation', async () => {
    mockPhase = { status: 'guideline_violation' };
    const screen = await render(<ReplyAssistResult />);

    expect(screen.getByTestId('reply-result-guideline-violation')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reply-result-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows a not-found fallback when there is no pending request (直接アクセス等)', async () => {
    mockPendingRequest = null;
    const screen = await render(<ReplyAssistResult />);

    expect(screen.getByTestId('reply-result-not-found')).toBeTruthy();
  });
});

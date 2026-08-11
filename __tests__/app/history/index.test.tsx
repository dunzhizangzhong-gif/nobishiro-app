import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  // 初回ロードは素のuseEffectが担うため、フォーカス時再取得のuseFocusEffectはno-opでよい
  useFocusEffect: jest.fn(),
}));

const mockGetAssessments = jest.fn();
const mockGetReplySessions = jest.fn();
jest.mock('../../../src/lib/storage', () => ({
  getAssessments: (...args: unknown[]) => mockGetAssessments(...args),
  getReplySessions: (...args: unknown[]) => mockGetReplySessions(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../../src/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import History from '../../../app/history/index';

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockGetAssessments.mockReset();
  mockGetReplySessions.mockReset();
  mockTrackEvent.mockReset();
});

describe('History (S-9, AC-012)', () => {
  it('DL-009: shows the empty state when both photo and reply history are empty', async () => {
    mockGetAssessments.mockResolvedValue([]);
    mockGetReplySessions.mockResolvedValue([]);

    const screen = await render(<History />);

    await waitFor(() => expect(screen.getByTestId('history-empty')).toBeTruthy());
    fireEvent.press(screen.getByTestId('history-empty-cta'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('AC-015: fires history_viewed on mount', async () => {
    mockGetAssessments.mockResolvedValue([]);
    mockGetReplySessions.mockResolvedValue([]);

    await render(<History />);

    await waitFor(() => expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'history_viewed' }));
  });

  it('lists photo and reply entries sorted by createdAt descending, and navigates on tap', async () => {
    mockGetAssessments.mockResolvedValue([
      {
        status: 'ok',
        data: {
          id: 'p1',
          createdAt: '2026-08-09T00:00:00.000Z',
          photoRefs: ['a'],
          recommendedIndex: 0,
          results: [{ score: 4, reasons: ['x'], improvements: [] }],
        },
      },
    ]);
    mockGetReplySessions.mockResolvedValue([
      {
        status: 'ok',
        data: {
          id: 'r1',
          createdAt: '2026-08-10T00:00:00.000Z',
          inputType: 'text',
          inputText: 'こんにちは',
          tone: null,
          suggestions: [{ text: 'x', aim: 'y' }],
        },
      },
    ]);

    const screen = await render(<History />);

    await waitFor(() => expect(screen.getByTestId('history-item-photo-p1')).toBeTruthy());
    expect(screen.getByTestId('history-item-reply-r1')).toBeTruthy();

    // 返信(2026-08-10)の方が写真判定(2026-08-09)より新しいため先に描画される
    const serialized = JSON.stringify(screen.toJSON());
    expect(serialized.indexOf('r1')).toBeLessThan(serialized.indexOf('p1'));

    fireEvent.press(screen.getByTestId('history-item-reply-r1'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/reply-assist/result?id=r1'));

    fireEvent.press(screen.getByTestId('history-item-photo-p1'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/photo-assessment/result?id=p1'));
  });

  it('AC-012 失敗時: shows "表示できません" for corrupted entries while still listing valid ones', async () => {
    mockGetAssessments.mockResolvedValue([
      { status: 'corrupted', raw: { broken: true } },
      {
        status: 'ok',
        data: {
          id: 'p2',
          createdAt: '2026-08-10T00:00:00.000Z',
          photoRefs: ['a'],
          recommendedIndex: 0,
          results: [{ score: 4, reasons: ['x'], improvements: [] }],
        },
      },
    ]);
    mockGetReplySessions.mockResolvedValue([]);

    const screen = await render(<History />);

    // ソート後、createdAtを持たないcorrupted要素は末尾(index 1)に配置される
    await waitFor(() => expect(screen.getByTestId('history-item-photo-p2')).toBeTruthy());
    expect(screen.getByTestId('history-item-corrupted-1')).toBeTruthy();
    expect(screen.queryByTestId('history-empty')).toBeNull();
  });
});

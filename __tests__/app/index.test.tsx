import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockEntitlement: { isPro: boolean; isLoading: boolean; refresh: jest.Mock } = {
  isPro: false,
  isLoading: false,
  refresh: jest.fn(),
};
jest.mock('../../src/features/paywall/useEntitlement', () => ({
  useEntitlement: () => mockEntitlement,
}));

const mockHasRemainingQuota = jest.fn();
jest.mock('../../src/features/quota/quotaGate', () => ({
  hasRemainingQuota: (...args: unknown[]) => mockHasRemainingQuota(...args),
}));

jest.mock('../../src/features/quota/useQuota', () => ({
  useQuota: () => ({
    isLoading: false,
    remainingPhotoAssessments: 2,
    remainingReplyGenerations: 4,
    refresh: jest.fn(),
  }),
}));

import Home from '../../app/index';

beforeEach(() => {
  mockPush.mockReset();
  mockHasRemainingQuota.mockReset();
  mockEntitlement = { isPro: false, isLoading: false, refresh: jest.fn() };
});

describe('Home CTA (AC-010: ペイウォール分岐)', () => {
  it('navigates directly to photo select when quota remains and not pro', async () => {
    mockHasRemainingQuota.mockResolvedValue(true);
    const screen = await render(<Home />);

    fireEvent.press(screen.getByTestId('home-cta-photo'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/photo-assessment/select'));
    expect(mockHasRemainingQuota).toHaveBeenCalledWith('photoAssessments');
  });

  it('AC-010: redirects to the paywall with intent=photo-assessment when photo quota is exhausted', async () => {
    mockHasRemainingQuota.mockResolvedValue(false);
    const screen = await render(<Home />);

    fireEvent.press(screen.getByTestId('home-cta-photo'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/paywall?intent=photo-assessment'));
  });

  it('AC-010: redirects to the paywall with intent=reply-assist when reply quota is exhausted', async () => {
    mockHasRemainingQuota.mockResolvedValue(false);
    const screen = await render(<Home />);

    fireEvent.press(screen.getByTestId('home-cta-reply'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/paywall?intent=reply-assist'));
    expect(mockHasRemainingQuota).toHaveBeenCalledWith('replyGenerations');
  });

  it('AC-011: pro users skip the quota check entirely and navigate directly', async () => {
    mockEntitlement = { isPro: true, isLoading: false, refresh: jest.fn() };
    const screen = await render(<Home />);

    fireEvent.press(screen.getByTestId('home-cta-photo'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/photo-assessment/select'));
    expect(mockHasRemainingQuota).not.toHaveBeenCalled();
  });

  it('AC-011: shows a Pro badge instead of the remaining-count summary when pro', async () => {
    mockEntitlement = { isPro: true, isLoading: false, refresh: jest.fn() };
    const screen = await render(<Home />);

    expect(screen.getByTestId('home-pro-badge')).toBeTruthy();
    expect(screen.queryByTestId('home-quota-summary')).toBeNull();
  });

  it('shows the remaining-count summary (not the Pro badge) when not pro', async () => {
    const screen = await render(<Home />);

    expect(screen.getByTestId('home-quota-summary')).toBeTruthy();
    expect(screen.queryByTestId('home-pro-badge')).toBeNull();
  });
});

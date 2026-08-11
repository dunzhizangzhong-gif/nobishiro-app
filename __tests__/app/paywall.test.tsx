import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: { intent?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
    purchasePackage: (...args: unknown[]) => mockPurchasePackage(...args),
    restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
  },
}));

const mockIsPurchasesConfigured = jest.fn();
jest.mock('../../src/lib/purchases', () => ({
  isPurchasesConfigured: () => mockIsPurchasesConfigured(),
}));

let mockEntitlement = { isPro: false, isLoading: false, refresh: jest.fn() };
jest.mock('../../src/features/paywall/useEntitlement', () => ({
  useEntitlement: () => mockEntitlement,
}));

const mockTrackEvent = jest.fn();
jest.mock('../../src/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import Paywall from '../../app/paywall';

const monthlyPackage = {
  identifier: 'monthly',
  product: { priceString: '¥980' },
};

beforeEach(() => {
  mockBack.mockReset();
  mockReplace.mockReset();
  mockParams = {};
  mockGetOfferings.mockReset();
  mockPurchasePackage.mockReset();
  mockRestorePurchases.mockReset();
  mockIsPurchasesConfigured.mockReset();
  mockEntitlement = { isPro: false, isLoading: false, refresh: jest.fn().mockResolvedValue(undefined) };
  mockTrackEvent.mockReset();
});

describe('Paywall (AC-010)', () => {
  it('AC-015: fires paywall_viewed on mount', async () => {
    mockIsPurchasesConfigured.mockReturnValue(false);

    await render(<Paywall />);

    await waitFor(() => expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'paywall_viewed' }));
  });

  it('shows "現在ご利用いただけません" with no restore button when Purchases is not configured', async () => {
    mockIsPurchasesConfigured.mockReturnValue(false);

    const screen = await render(<Paywall />);

    await waitFor(() => expect(screen.getByTestId('paywall-unavailable-message')).toBeTruthy());
    expect(screen.queryByTestId('paywall-restore')).toBeNull();
    expect(screen.getByTestId('paywall-close')).toBeTruthy();
  });

  it('shows unavailable (with restore available) when offerings are configured but empty', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [] } });

    const screen = await render(<Paywall />);

    await waitFor(() => expect(screen.getByTestId('paywall-unavailable-message')).toBeTruthy());
    expect(screen.getByTestId('paywall-restore')).toBeTruthy();
  });

  it('AC-010: shows price and a functioning purchase button for each package', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    mockPurchasePackage.mockResolvedValue({});

    const screen = await render(<Paywall />);

    await waitFor(() => expect(screen.getByTestId('paywall-price-monthly')).toBeTruthy());
    expect(screen.getByTestId('paywall-price-monthly').props.children).toBe('¥980');

    fireEvent.press(screen.getByTestId('paywall-purchase-monthly'));

    await waitFor(() => expect(mockPurchasePackage).toHaveBeenCalledWith(monthlyPackage));
    await waitFor(() => expect(mockEntitlement.refresh).toHaveBeenCalledTimes(1));
    // AC-015: purchase_completed
    expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'purchase_completed' });
  });

  it('AC-010 失敗時: shows no error message when the user cancels the purchase', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    mockPurchasePackage.mockRejectedValue({ userCancelled: true });

    const screen = await render(<Paywall />);
    await waitFor(() => expect(screen.getByTestId('paywall-purchase-monthly')).toBeTruthy());

    fireEvent.press(screen.getByTestId('paywall-purchase-monthly'));

    await waitFor(() => expect(mockPurchasePackage).toHaveBeenCalled());
    expect(screen.queryByTestId('paywall-error-message')).toBeNull();
  });

  it('AC-010 失敗時: shows an error message when the purchase fails for a reason other than cancellation', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    mockPurchasePackage.mockRejectedValue(new Error('network error'));

    const screen = await render(<Paywall />);
    await waitFor(() => expect(screen.getByTestId('paywall-purchase-monthly')).toBeTruthy());

    fireEvent.press(screen.getByTestId('paywall-purchase-monthly'));

    await waitFor(() => expect(screen.getByTestId('paywall-error-message')).toBeTruthy());
  });

  it('AC-010: restore calls Purchases.restorePurchases() and refreshes entitlement', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    mockRestorePurchases.mockResolvedValue({});

    const screen = await render(<Paywall />);
    await waitFor(() => expect(screen.getByTestId('paywall-restore')).toBeTruthy());

    fireEvent.press(screen.getByTestId('paywall-restore'));

    await waitFor(() => expect(mockRestorePurchases).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockEntitlement.refresh).toHaveBeenCalledTimes(1));
  });

  it('AC-010: redirects to the photo-assessment flow when already pro and intent=photo-assessment', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    mockParams = { intent: 'photo-assessment' };
    mockEntitlement = { isPro: true, isLoading: false, refresh: jest.fn() };

    await render(<Paywall />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/photo-assessment/select'));
  });

  it('AC-010: redirects to the reply-assist flow when already pro and intent=reply-assist', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    mockParams = { intent: 'reply-assist' };
    mockEntitlement = { isPro: true, isLoading: false, refresh: jest.fn() };

    await render(<Paywall />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/reply-assist/input'));
  });

  it('goes back when already pro and no intent is given', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    mockParams = {};
    mockEntitlement = { isPro: true, isLoading: false, refresh: jest.fn() };

    await render(<Paywall />);

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });
});

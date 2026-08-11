import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGetCustomerInfo = jest.fn();
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { getCustomerInfo: (...args: unknown[]) => mockGetCustomerInfo(...args) },
}));

const mockIsPurchasesConfigured = jest.fn();
jest.mock('../../lib/purchases', () => ({
  PRO_ENTITLEMENT_ID: 'pro',
  isPurchasesConfigured: () => mockIsPurchasesConfigured(),
}));

import { useEntitlement } from './useEntitlement';

beforeEach(() => {
  mockGetCustomerInfo.mockReset();
  mockIsPurchasesConfigured.mockReset();
});

describe('useEntitlement (AC-011)', () => {
  it('is not pro and does not call RevenueCat when Purchases is not configured (APIキー未設定)', async () => {
    mockIsPurchasesConfigured.mockReturnValue(false);

    const { result } = await renderHook(() => useEntitlement());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPro).toBe(false);
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
  });

  it('is pro when the "pro" entitlement is active', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetCustomerInfo.mockResolvedValue({ entitlements: { active: { pro: {} } } });

    const { result } = await renderHook(() => useEntitlement());

    await waitFor(() => expect(result.current.isPro).toBe(true));
  });

  it('is not pro when the "pro" entitlement is absent', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetCustomerInfo.mockResolvedValue({ entitlements: { active: {} } });

    const { result } = await renderHook(() => useEntitlement());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPro).toBe(false);
  });

  it('AC-011 失敗時: falls back to isPro=false when getCustomerInfo throws', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetCustomerInfo.mockRejectedValue(new Error('network error'));

    const { result } = await renderHook(() => useEntitlement());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPro).toBe(false);
  });

  it('refresh() re-checks entitlement status', async () => {
    mockIsPurchasesConfigured.mockReturnValue(true);
    mockGetCustomerInfo.mockResolvedValue({ entitlements: { active: {} } });

    const { result } = await renderHook(() => useEntitlement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPro).toBe(false);

    mockGetCustomerInfo.mockResolvedValue({ entitlements: { active: { pro: {} } } });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isPro).toBe(true);
  });
});

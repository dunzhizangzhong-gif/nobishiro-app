const mockConfigure = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { configure: (...args: unknown[]) => mockConfigure(...args) },
}));

describe('initPurchases (AC-017と同じ方針: APIキー未設定時はinitをスキップする)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = originalEnv;
    jest.resetModules();
    mockConfigure.mockReset();
  });

  it('does not call Purchases.configure when the API key is unset', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    const { initPurchases, isPurchasesConfigured } = require('./purchases');

    initPurchases();

    expect(mockConfigure).not.toHaveBeenCalled();
    expect(isPurchasesConfigured()).toBe(false);
  });

  it('calls Purchases.configure with the API key when set', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'test-key';
    const { initPurchases, isPurchasesConfigured } = require('./purchases');

    initPurchases();

    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(isPurchasesConfigured()).toBe(true);
  });

  it('only configures once even if called multiple times', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'test-key';
    const { initPurchases } = require('./purchases');

    initPurchases();
    initPurchases();

    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });
});

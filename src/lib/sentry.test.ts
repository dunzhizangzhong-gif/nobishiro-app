const mockInit = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: (...args: unknown[]) => mockInit(...args),
}));

describe('initSentry (AC-017)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = originalEnv;
    jest.resetModules();
    mockInit.mockReset();
  });

  it('AC-017 失敗時: does not initialize Sentry when the DSN is unset (does not crash)', async () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const { initSentry, isSentryConfigured } = require('./sentry');

    expect(() => initSentry()).not.toThrow();
    expect(mockInit).not.toHaveBeenCalled();
    expect(isSentryConfigured()).toBe(false);
  });

  it('initializes Sentry with the DSN read from the environment variable (not hardcoded)', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
    const { initSentry, isSentryConfigured } = require('./sentry');

    initSentry();

    expect(mockInit).toHaveBeenCalledWith({ dsn: 'https://example@o0.ingest.sentry.io/0' });
    expect(isSentryConfigured()).toBe(true);
  });

  it('only initializes once even if called multiple times', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
    const { initSentry } = require('./sentry');

    initSentry();
    initSentry();

    expect(mockInit).toHaveBeenCalledTimes(1);
  });
});

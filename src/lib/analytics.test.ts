const mockCapture = jest.fn();
const mockConstructor = jest.fn();

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: class MockPostHog {
    constructor(...args: unknown[]) {
      mockConstructor(...args);
    }
    capture(...args: unknown[]) {
      return mockCapture(...args);
    }
  },
}));

describe('analytics (AC-015)', () => {
  const originalApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const originalHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;

  afterEach(() => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalApiKey;
    process.env.EXPO_PUBLIC_POSTHOG_HOST = originalHost;
    jest.resetModules();
    mockCapture.mockReset();
    mockConstructor.mockReset();
  });

  it('AC-015 失敗時と同じ方針: does not initialize PostHog and trackEvent is a no-op when the API key is unset', async () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const { initAnalytics, isAnalyticsConfigured, trackEvent } = require('./analytics');

    initAnalytics();
    expect(isAnalyticsConfigured()).toBe(false);

    expect(() => trackEvent({ name: 'onboarding_completed' })).not.toThrow();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('initializes PostHog with the API key and host read from environment variables', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
    process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://posthog.example.com';
    const { initAnalytics, isAnalyticsConfigured } = require('./analytics');

    initAnalytics();

    expect(mockConstructor).toHaveBeenCalledWith('phc_test', { host: 'https://posthog.example.com' });
    expect(isAnalyticsConfigured()).toBe(true);
  });

  it('only initializes once even if called multiple times', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
    const { initAnalytics } = require('./analytics');

    initAnalytics();
    initAnalytics();

    expect(mockConstructor).toHaveBeenCalledTimes(1);
  });

  it('AC-015: sends a simple event (no properties) with just its name', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
    const { initAnalytics, trackEvent } = require('./analytics');
    initAnalytics();

    trackEvent({ name: 'reply_copied' });

    expect(mockCapture).toHaveBeenCalledWith('reply_copied');
  });

  it('AC-015: assessment_completed carries only durationSeconds (no photo/reason content)', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
    const { initAnalytics, trackEvent } = require('./analytics');
    initAnalytics();

    trackEvent({ name: 'assessment_completed', properties: { durationSeconds: 12 } });

    expect(mockCapture).toHaveBeenCalledWith('assessment_completed', { durationSeconds: 12 });
  });

  it('AC-015: reply_generated carries only inputType (no message content)', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
    const { initAnalytics, trackEvent } = require('./analytics');
    initAnalytics();

    trackEvent({ name: 'reply_generated', properties: { inputType: 'screenshot' } });

    expect(mockCapture).toHaveBeenCalledWith('reply_generated', { inputType: 'screenshot' });
  });

  it('AC-015 失敗時: a PostHog capture failure is swallowed (fire-and-forget) and does not throw', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
    mockCapture.mockImplementation(() => {
      throw new Error('network error');
    });
    const { initAnalytics, trackEvent } = require('./analytics');
    initAnalytics();

    expect(() => trackEvent({ name: 'history_viewed' })).not.toThrow();
  });
});

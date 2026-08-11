const mockFetch = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));

import { isOnline } from './network';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('isOnline (AC-016 オフライン検知の土台)', () => {
  it('returns true when connected and internet is reachable', async () => {
    mockFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    expect(await isOnline()).toBe(true);
  });

  it('returns false when not connected', async () => {
    mockFetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    expect(await isOnline()).toBe(false);
  });

  it('returns false when connected but internet is explicitly unreachable', async () => {
    mockFetch.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    expect(await isOnline()).toBe(false);
  });

  it('treats unknown reachability (null) as online when connected', async () => {
    mockFetch.mockResolvedValue({ isConnected: true, isInternetReachable: null });
    expect(await isOnline()).toBe(true);
  });
});

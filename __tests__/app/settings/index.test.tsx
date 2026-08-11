import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRestorePurchases = jest.fn();
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args) },
}));

const mockRefresh = jest.fn();
jest.mock('../../../src/features/paywall/useEntitlement', () => ({
  useEntitlement: () => ({ isPro: false, isLoading: false, refresh: mockRefresh }),
}));

const mockDeleteHistory = jest.fn();
jest.mock('../../../src/lib/storage', () => ({
  deleteHistory: (...args: unknown[]) => mockDeleteHistory(...args),
}));

import Settings from '../../../app/settings/index';

beforeEach(() => {
  mockPush.mockReset();
  mockRestorePurchases.mockReset();
  mockRefresh.mockReset();
  mockDeleteHistory.mockReset();
  mockDeleteHistory.mockResolvedValue(undefined);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Settings (S-11, AC-020データ削除)', () => {
  it('AC-020: deletes history data only after the user confirms in the dialog', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirmButton = buttons?.find((button) => button.text === '削除する');
      confirmButton?.onPress?.();
    });

    const screen = await render(<Settings />);
    fireEvent.press(screen.getByTestId('settings-delete-button'));

    await waitFor(() => expect(mockDeleteHistory).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('settings-delete-success')).toBeTruthy());
  });

  it('AC-020 失敗時: does not delete anything when the user cancels the dialog', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const cancelButton = buttons?.find((button) => button.text === 'キャンセル');
      cancelButton?.onPress?.();
    });

    const screen = await render(<Settings />);
    fireEvent.press(screen.getByTestId('settings-delete-button'));

    expect(mockDeleteHistory).not.toHaveBeenCalled();
    expect(screen.queryByTestId('settings-delete-success')).toBeNull();
  });

  it('restores purchases and refreshes entitlement', async () => {
    mockRestorePurchases.mockResolvedValue({});
    const screen = await render(<Settings />);

    fireEvent.press(screen.getByTestId('settings-restore'));

    await waitFor(() => expect(mockRestorePurchases).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it('shows an error message when restore fails', async () => {
    mockRestorePurchases.mockRejectedValue(new Error('network error'));
    const screen = await render(<Settings />);

    fireEvent.press(screen.getByTestId('settings-restore'));

    await waitFor(() => expect(screen.getByTestId('settings-restore-error')).toBeTruthy());
  });

  it('disables the privacy policy / terms rows when their URLs are unset', async () => {
    const screen = await render(<Settings />);

    expect(screen.getByTestId('settings-privacy-policy').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('settings-terms').props.accessibilityState?.disabled).toBe(true);
  });

  it('navigates to the licenses screen', async () => {
    const screen = await render(<Settings />);

    fireEvent.press(screen.getByTestId('settings-licenses-link'));
    expect(mockPush).toHaveBeenCalledWith('/settings/licenses');
  });

  it('opens the Apple subscription management page', async () => {
    const screen = await render(<Settings />);

    fireEvent.press(screen.getByTestId('settings-manage-subscription'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions');
  });
});

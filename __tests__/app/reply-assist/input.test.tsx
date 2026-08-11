import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLaunchImageLibraryAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

let mockPermission: { state: string; isChecking: boolean; requestAgain: jest.Mock } = {
  state: 'granted',
  isChecking: false,
  requestAgain: jest.fn(),
};
jest.mock('../../../src/features/permissions/usePhotoLibraryPermission', () => ({
  usePhotoLibraryPermission: () => mockPermission,
}));

const mockIsOnline = jest.fn();
jest.mock('../../../src/lib/network', () => ({
  isOnline: (...args: unknown[]) => mockIsOnline(...args),
}));

import { ReplyAssistSessionProvider } from '../../../src/features/reply-assist/ReplyAssistSessionContext';
import ReplyAssistInput from '../../../app/reply-assist/input';

function renderScreen() {
  return render(
    <ReplyAssistSessionProvider>
      <ReplyAssistInput />
    </ReplyAssistSessionProvider>
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockLaunchImageLibraryAsync.mockReset();
  mockIsOnline.mockReset();
  mockIsOnline.mockResolvedValue(true);
  mockPermission = { state: 'granted', isChecking: false, requestAgain: jest.fn() };
});

describe('ReplyAssistInput (AC-007テキスト入力 / AC-019権限分岐 / AC-016オフライン)', () => {
  it('AC-007 失敗時: disables submit and shows guidance when the text field is empty', async () => {
    const screen = await renderScreen();

    expect(screen.getByTestId('reply-input-validation-message')).toBeTruthy();
    expect(screen.getByTestId('reply-input-submit-text').props.accessibilityState?.disabled).toBe(true);
  });

  it('AC-007: enables submit once valid text is entered and navigates to the result screen when online', async () => {
    const screen = await renderScreen();

    fireEvent.changeText(screen.getByTestId('reply-input-text-field'), 'こんにちは');
    await waitFor(() =>
      expect(screen.getByTestId('reply-input-submit-text').props.accessibilityState?.disabled).toBe(false)
    );

    fireEvent.press(screen.getByTestId('reply-input-submit-text'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/reply-assist/result'));
  });

  it('AC-016: shows an offline message and does not navigate when offline', async () => {
    mockIsOnline.mockResolvedValue(false);
    const screen = await renderScreen();

    fireEvent.changeText(screen.getByTestId('reply-input-text-field'), 'こんにちは');
    await waitFor(() =>
      expect(screen.getByTestId('reply-input-submit-text').props.accessibilityState?.disabled).toBe(false)
    );
    fireEvent.press(screen.getByTestId('reply-input-submit-text'));

    await waitFor(() => expect(screen.getByTestId('reply-input-offline-message')).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('AC-019: denied permission shows the denied view with a text-tab fallback hint on the screenshot tab', async () => {
    mockPermission = { state: 'denied', isChecking: false, requestAgain: jest.fn() };
    const screen = await renderScreen();

    fireEvent.press(screen.getByTestId('reply-input-tab-screenshot'));

    await waitFor(() => expect(screen.getByTestId('photo-permission-denied')).toBeTruthy());
    expect(screen.getByTestId('photo-permission-denied-text-hint')).toBeTruthy();
  });

  it('AC-019: limited permission shows the limited-access banner and still allows picking', async () => {
    mockPermission = { state: 'limited', isChecking: false, requestAgain: jest.fn() };
    const screen = await renderScreen();

    fireEvent.press(screen.getByTestId('reply-input-tab-screenshot'));

    await waitFor(() => expect(screen.getByTestId('photo-permission-limited-banner')).toBeTruthy());
    expect(screen.getByTestId('reply-input-pick-screenshot')).toBeTruthy();
  });

  it('allows switching back to the text tab after viewing a denied screenshot tab', async () => {
    mockPermission = { state: 'denied', isChecking: false, requestAgain: jest.fn() };
    const screen = await renderScreen();

    fireEvent.press(screen.getByTestId('reply-input-tab-screenshot'));
    await waitFor(() => expect(screen.getByTestId('photo-permission-denied')).toBeTruthy());

    fireEvent.press(screen.getByTestId('reply-input-tab-text'));
    await waitFor(() => expect(screen.getByTestId('reply-input-text-field')).toBeTruthy());
  });

  it('selects a screenshot and navigates to the result screen when online', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/s.jpg', fileName: 's.jpg', mimeType: 'image/jpeg' }],
    });
    const screen = await renderScreen();

    fireEvent.press(screen.getByTestId('reply-input-tab-screenshot'));
    await waitFor(() => expect(screen.getByTestId('reply-input-pick-screenshot')).toBeTruthy());

    fireEvent.press(screen.getByTestId('reply-input-pick-screenshot'));
    await waitFor(() => expect(screen.getByTestId('reply-input-screenshot-selected')).toBeTruthy());

    fireEvent.press(screen.getByTestId('reply-input-submit-screenshot'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/reply-assist/result'));
  });

  it('lets the user select and deselect a tone chip', async () => {
    const screen = await renderScreen();

    const casualChip = screen.getByTestId('reply-input-tone-casual');
    fireEvent.press(casualChip);
    fireEvent.press(casualChip);
    // 選択/解除で例外が起きないことのみ確認(状態はSessionContext経由でsubmit時に使われる)
    expect(casualChip).toBeTruthy();
  });
});

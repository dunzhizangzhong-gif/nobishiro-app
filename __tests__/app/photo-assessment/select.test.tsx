import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLaunchImageLibraryAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

jest.mock('../../../src/features/permissions/usePhotoLibraryPermission', () => ({
  usePhotoLibraryPermission: () => ({ state: 'granted', isChecking: false, requestAgain: jest.fn() }),
}));

const mockIsOnline = jest.fn();
jest.mock('../../../src/lib/network', () => ({
  isOnline: (...args: unknown[]) => mockIsOnline(...args),
}));

import { PhotoAssessmentSessionProvider } from '../../../src/features/photo-assessment/PhotoAssessmentSessionContext';
import PhotoAssessmentSelect from '../../../app/photo-assessment/select';

function renderScreen() {
  return render(
    <PhotoAssessmentSessionProvider>
      <PhotoAssessmentSelect />
    </PhotoAssessmentSessionProvider>
  );
}

async function selectOnePhoto(screen: Awaited<ReturnType<typeof renderScreen>>) {
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/a.jpg', assetId: 'asset-1', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
  });
  fireEvent.press(screen.getByTestId('photo-select-pick-button'));
  await waitFor(() =>
    expect(screen.getByTestId('photo-select-count').props.children.join('')).toContain('1')
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockLaunchImageLibraryAsync.mockReset();
  mockIsOnline.mockReset();
});

describe('PhotoAssessmentSelect (AC-001 バリデーション / AC-016 オフライン検知)', () => {
  it('disables submit and shows the guidance message when 0 photos are selected', async () => {
    const screen = await renderScreen();

    expect(screen.getByTestId('photo-select-validation-message')).toBeTruthy();
    expect(screen.getByTestId('photo-select-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('AC-016: shows an offline message and does not navigate when offline', async () => {
    const screen = await renderScreen();
    await selectOnePhoto(screen);

    mockIsOnline.mockResolvedValue(false);
    fireEvent.press(screen.getByTestId('photo-select-submit'));

    await waitFor(() => expect(screen.getByTestId('photo-select-offline-message')).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to the processing screen when online', async () => {
    const screen = await renderScreen();
    await selectOnePhoto(screen);

    mockIsOnline.mockResolvedValue(true);
    fireEvent.press(screen.getByTestId('photo-select-submit'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/photo-assessment/processing'));
  });
});

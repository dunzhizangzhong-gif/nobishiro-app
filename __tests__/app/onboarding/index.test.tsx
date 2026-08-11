import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockConfirmAge = jest.fn();
jest.mock('../../../src/features/onboarding/ProfileContext', () => ({
  useProfile: () => ({ confirmAge: mockConfirmAge }),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../../src/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import Onboarding from '../../../app/onboarding/index';

beforeEach(() => {
  mockReplace.mockReset();
  mockConfirmAge.mockReset();
  mockConfirmAge.mockResolvedValue(undefined);
  mockTrackEvent.mockReset();
});

describe('Onboarding (AC-013年齢確認 / AC-015 onboarding_completed)', () => {
  it('AC-015: fires onboarding_completed after confirming as an adult, and navigates home', async () => {
    const screen = await render(<Onboarding />);
    fireEvent.press(screen.getByTestId('onboarding-next'));
    await waitFor(() => expect(screen.getByTestId('onboarding-copy-trust')).toBeTruthy());
    fireEvent.press(screen.getByTestId('onboarding-next'));
    await waitFor(() => expect(screen.getByTestId('onboarding-age-yes')).toBeTruthy());

    fireEvent.press(screen.getByTestId('onboarding-age-yes'));

    await waitFor(() => expect(mockConfirmAge).toHaveBeenCalledWith(true));
    expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'onboarding_completed' });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('does not fire onboarding_completed when the user is under 18', async () => {
    const screen = await render(<Onboarding />);
    fireEvent.press(screen.getByTestId('onboarding-next'));
    await waitFor(() => expect(screen.getByTestId('onboarding-copy-trust')).toBeTruthy());
    fireEvent.press(screen.getByTestId('onboarding-next'));
    await waitFor(() => expect(screen.getByTestId('onboarding-age-yes')).toBeTruthy());

    fireEvent.press(screen.getByTestId('onboarding-age-no'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/ineligible'));
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});

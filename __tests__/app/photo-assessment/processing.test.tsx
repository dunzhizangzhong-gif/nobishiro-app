import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

jest.mock('../../../src/features/photo-assessment/PhotoAssessmentSessionContext', () => ({
  usePhotoAssessmentSession: () => ({
    selectedAssets: [{ uri: 'file:///tmp/a.jpg', assetId: 'asset-1', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
  }),
}));

jest.mock('../../../src/features/paywall/useEntitlement', () => ({
  useEntitlement: () => ({ isPro: false, isLoading: false, refresh: jest.fn() }),
}));

const mockCancel = jest.fn();
const mockRetry = jest.fn();
let mockPhase: unknown = { status: 'pending' };
jest.mock('../../../src/features/photo-assessment/usePhotoAssessmentSubmission', () => ({
  usePhotoAssessmentSubmission: () => ({ phase: mockPhase, retry: mockRetry, cancel: mockCancel }),
}));

import PhotoAssessmentProcessing from '../../../app/photo-assessment/processing';

beforeEach(() => {
  mockReplace.mockReset();
  mockBack.mockReset();
  mockCancel.mockReset();
  mockRetry.mockReset();
  mockPhase = { status: 'pending' };
});

describe('PhotoAssessmentProcessing (AC-002/AC-022/AC-023/AC-024)', () => {
  it('shows the processing view while pending, and cancel() + back() on cancel', async () => {
    const screen = await render(<PhotoAssessmentProcessing />);

    expect(screen.getByTestId('photo-assessment-processing')).toBeTruthy();
    fireEvent.press(screen.getByTestId('photo-assessment-cancel'));

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('AC-002: shows a retry button on timeout, and it calls retry()', async () => {
    mockPhase = { status: 'timeout' };
    const screen = await render(<PhotoAssessmentProcessing />);

    expect(screen.getByTestId('photo-assessment-error-message')).toBeTruthy();
    fireEvent.press(screen.getByTestId('photo-assessment-retry'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('navigates to the result screen on success', async () => {
    mockPhase = { status: 'success', assessmentId: 'a1' };
    await render(<PhotoAssessmentProcessing />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/photo-assessment/result?id=a1'));
  });

  it('AC-023: shows the rate-limited message and a back button', async () => {
    mockPhase = { status: 'rate_limited' };
    const screen = await render(<PhotoAssessmentProcessing />);

    expect(screen.getByTestId('photo-assessment-rate-limited').props.children).toBe(
      'アクセスが集中しています。しばらくしてから再度お試しください'
    );
    fireEvent.press(screen.getByTestId('photo-assessment-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('AC-022: shows the guideline-violation message when the whole batch was excluded by moderation', async () => {
    mockPhase = { status: 'guideline_violation' };
    const screen = await render(<PhotoAssessmentProcessing />);

    expect(screen.getByTestId('photo-assessment-guideline-violation')).toBeTruthy();
    fireEvent.press(screen.getByTestId('photo-assessment-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('AC-024: shows the no-person-detected message when the whole batch had no detectable person', async () => {
    mockPhase = { status: 'no_person_detected' };
    const screen = await render(<PhotoAssessmentProcessing />);

    expect(screen.getByTestId('photo-assessment-no-person-detected').props.children).toBe(
      '人物が写っている写真を選んでください'
    );
    fireEvent.press(screen.getByTestId('photo-assessment-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

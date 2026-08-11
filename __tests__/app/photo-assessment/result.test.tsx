import { render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockParams: { id: string } = { id: 'a1' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));

const mockGetUri = jest.fn();
jest.mock('expo-media-library', () => ({
  Asset: (...args: [string]) => ({ id: args[0], getUri: mockGetUri }),
}));

import { addAssessment } from '../../../src/lib/storage';
import type { PhotoAssessment } from '../../../src/types/domain';
import PhotoAssessmentResult from '../../../app/photo-assessment/result';

const baseAssessment: PhotoAssessment = {
  id: 'a1',
  createdAt: '2026-08-10T00:00:00.000Z',
  photoRefs: ['asset-1', 'asset-2'],
  recommendedIndex: 1,
  results: [
    {
      score: 3,
      reasons: ['表情が硬い'],
      improvements: [{ category: 'expression', advice: '口角を上げて撮ると良い' }],
    },
    {
      score: 5,
      reasons: ['自然光が良い', '背景がすっきりしている'],
      improvements: [{ category: 'light', advice: '窓際で撮ると良い' }],
    },
  ],
};

beforeEach(() => {
  mockPush.mockReset();
  mockParams = { id: 'a1' };
  mockGetUri.mockReset();
  mockGetUri.mockRejectedValue(new Error('not found'));
});

describe('PhotoAssessmentResult (AC-001 結果表示 / AC-022・AC-024 除外表示)', () => {
  it('AC-001: shows the recommended badge on the recommended photo, and score/reasons/improvements for each result', async () => {
    await addAssessment(baseAssessment);

    const screen = await render(<PhotoAssessmentResult />);

    await waitFor(() => expect(screen.getByTestId('photo-result-card-0')).toBeTruthy());

    expect(screen.queryByTestId('photo-result-recommended-badge-0')).toBeNull();
    expect(screen.getByTestId('photo-result-recommended-badge-1')).toBeTruthy();

    expect(screen.getByTestId('photo-result-score-0').props.children.join('')).toContain('3');
    expect(screen.getByTestId('photo-result-score-1').props.children.join('')).toContain('5');

    expect(screen.getByTestId('photo-result-reason-0-0')).toBeTruthy();
    expect(screen.getByTestId('photo-result-reason-1-0')).toBeTruthy();
    expect(screen.getByTestId('photo-result-reason-1-1')).toBeTruthy();

    expect(screen.getByTestId('photo-result-improvement-0-0')).toBeTruthy();
    expect(screen.getByTestId('photo-result-improvement-1-0')).toBeTruthy();

    expect(screen.queryByTestId('photo-result-excluded-banner')).toBeNull();
  });

  it('AC-022/024: shows the exclusion banner when excludedCount is present', async () => {
    await addAssessment({ ...baseAssessment, id: 'a2', excludedCount: 2 });
    mockParams = { id: 'a2' };

    const screen = await render(<PhotoAssessmentResult />);

    await waitFor(() => expect(screen.getByTestId('photo-result-excluded-banner')).toBeTruthy());
    expect(screen.getByTestId('photo-result-excluded-banner').props.children.props.children.join('')).toContain(
      '2枚'
    );
  });

  it('does not show the exclusion banner when there is no exclusion', async () => {
    await addAssessment(baseAssessment);

    const screen = await render(<PhotoAssessmentResult />);

    await waitFor(() => expect(screen.getByTestId('photo-result-card-0')).toBeTruthy());
    expect(screen.queryByTestId('photo-result-excluded-banner')).toBeNull();
  });

  it('shows a not-found message when no matching record exists', async () => {
    mockParams = { id: 'does-not-exist' };

    const screen = await render(<PhotoAssessmentResult />);

    await waitFor(() => expect(screen.getByTestId('photo-result-not-found')).toBeTruthy());
  });

  it('renders a thumbnail image once the assetId resolves to a uri', async () => {
    mockGetUri.mockResolvedValue('ph://resolved/asset-1.jpg');
    await addAssessment(baseAssessment);

    const screen = await render(<PhotoAssessmentResult />);

    await waitFor(() => expect(screen.getByTestId('photo-result-thumbnail-image-0')).toBeTruthy());
    expect(screen.getByTestId('photo-result-thumbnail-image-0').props.source).toEqual({
      uri: 'ph://resolved/asset-1.jpg',
    });
  });

  it('shows a placeholder when the thumbnail cannot be resolved', async () => {
    mockGetUri.mockRejectedValue(new Error('not found'));
    await addAssessment(baseAssessment);

    const screen = await render(<PhotoAssessmentResult />);

    await waitFor(() => expect(screen.getByTestId('photo-result-thumbnail-placeholder-0')).toBeTruthy());
  });

  it('renders a file:// fallback ref directly without calling expo-media-library (限定権限時)', async () => {
    await addAssessment({
      ...baseAssessment,
      id: 'a3',
      photoRefs: ['file:///tmp/ImagePicker/limited.jpg'],
      recommendedIndex: 0,
      results: [baseAssessment.results[0]],
    });
    mockParams = { id: 'a3' };

    const screen = await render(<PhotoAssessmentResult />);

    await waitFor(() => expect(screen.getByTestId('photo-result-thumbnail-image-0')).toBeTruthy());
    expect(screen.getByTestId('photo-result-thumbnail-image-0').props.source).toEqual({
      uri: 'file:///tmp/ImagePicker/limited.jpg',
    });
    expect(mockGetUri).not.toHaveBeenCalled();
  });
});

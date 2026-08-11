import { render, waitFor } from '@testing-library/react-native';

let mockParams: { category: string } = { category: 'light' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

const mockTrackEvent = jest.fn();
jest.mock('../../../../src/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import ReferenceImageScreen from '../../../../app/photo-assessment/reference/[category]';

beforeEach(() => {
  mockTrackEvent.mockReset();
});

describe('ReferenceImageScreen (AC-005 参考イメージの表示)', () => {
  it('shows the illustration placeholder and caption for a known category', async () => {
    mockParams = { category: 'light' };

    const screen = await render(<ReferenceImageScreen />);

    await waitFor(() => expect(screen.getByTestId('reference-caption-light-1')).toBeTruthy());
    expect(screen.getByTestId('reference-image-placeholder-light-1')).toBeTruthy();
  });

  it('AC-015: fires reference_viewed on mount', async () => {
    mockParams = { category: 'light' };

    await render(<ReferenceImageScreen />);

    await waitFor(() => expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'reference_viewed' }));
  });

  it('AC-005 失敗時: falls back to the "other" illustration for an unknown category (no blank screen)', async () => {
    mockParams = { category: 'unknown-category' };

    const screen = await render(<ReferenceImageScreen />);

    await waitFor(() => expect(screen.getByTestId('reference-caption-other-1')).toBeTruthy());
  });

  it('renders distinct content for each of the 6 categories', async () => {
    const categories = ['light', 'composition', 'expression', 'outfit', 'background', 'other'];
    for (const category of categories) {
      mockParams = { category };
      const screen = await render(<ReferenceImageScreen />);
      await waitFor(() => expect(screen.getByTestId(`reference-caption-${category}-1`)).toBeTruthy());
    }
  });
});

import { renderHook, waitFor } from '@testing-library/react-native';

const mockResolvePhotoUri = jest.fn();
jest.mock('../../lib/media/resolvePhotoUri', () => ({
  resolvePhotoUri: (...args: unknown[]) => mockResolvePhotoUri(...args),
}));

import { usePhotoThumbnail } from './usePhotoThumbnail';

beforeEach(() => {
  mockResolvePhotoUri.mockReset();
});

describe('usePhotoThumbnail', () => {
  it('resolves to the uri returned by resolvePhotoUri', async () => {
    mockResolvePhotoUri.mockResolvedValue('file:///tmp/a.jpg');

    const { result } = await renderHook(() => usePhotoThumbnail('asset-1'));

    await waitFor(() => expect(result.current).toBe('file:///tmp/a.jpg'));
    expect(mockResolvePhotoUri).toHaveBeenCalledWith('asset-1');
  });

  it('resolves to null when the ref cannot be resolved', async () => {
    mockResolvePhotoUri.mockResolvedValue(null);

    const { result } = await renderHook(() => usePhotoThumbnail('unresolvable'));

    await waitFor(() => expect(result.current).toBeNull());
  });

  it('is immediately null when no photoRef is given', async () => {
    const { result } = await renderHook(() => usePhotoThumbnail(undefined));

    expect(result.current).toBeNull();
    expect(mockResolvePhotoUri).not.toHaveBeenCalled();
  });
});

const mockGetUri = jest.fn();
const mockAssetConstructor = jest.fn().mockImplementation((id: string) => ({
  id,
  getUri: mockGetUri,
}));

jest.mock('expo-media-library', () => ({
  Asset: (...args: [string]) => mockAssetConstructor(...args),
}));

import { resolvePhotoUri } from './resolvePhotoUri';

beforeEach(() => {
  mockGetUri.mockReset();
  mockAssetConstructor.mockClear();
});

describe('resolvePhotoUri (サムネイル解決、S-5)', () => {
  it('returns a file:// uri directly without calling expo-media-library (限定権限フォールバック)', async () => {
    const result = await resolvePhotoUri('file:///tmp/ImagePicker/abc.jpg');
    expect(result).toBe('file:///tmp/ImagePicker/abc.jpg');
    expect(mockAssetConstructor).not.toHaveBeenCalled();
  });

  it('resolves an assetId via expo-media-library Asset.getUri()', async () => {
    mockGetUri.mockResolvedValue('ph://resolved-uri');
    const result = await resolvePhotoUri('ABCD1234-5678/L0/001');
    expect(result).toBe('ph://resolved-uri');
    expect(mockAssetConstructor).toHaveBeenCalledWith('ABCD1234-5678/L0/001');
  });

  it('returns null when Asset.getUri() throws (asset not found / no permission)', async () => {
    mockGetUri.mockRejectedValue(new Error('not found'));
    const result = await resolvePhotoUri('does-not-exist');
    expect(result).toBeNull();
  });

  it('returns null when getUri() resolves to an empty string', async () => {
    mockGetUri.mockResolvedValue('');
    const result = await resolvePhotoUri('some-asset-id');
    expect(result).toBeNull();
  });
});

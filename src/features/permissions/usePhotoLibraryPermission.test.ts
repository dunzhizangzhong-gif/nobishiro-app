import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { MediaLibraryPermissionResponse } from 'expo-image-picker';

import { mapPermissionResponse, usePhotoLibraryPermission } from './usePhotoLibraryPermission';

const mockGetMediaLibraryPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: (...args: unknown[]) => mockGetMediaLibraryPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
}));

type RawStatus = 'undetermined' | 'granted' | 'denied';

function response(
  overrides: { status: RawStatus; accessPrivileges?: 'all' | 'limited' | 'none' }
): MediaLibraryPermissionResponse {
  return {
    canAskAgain: true,
    expires: 'never',
    granted: false,
    ...overrides,
  } as MediaLibraryPermissionResponse;
}

beforeEach(() => {
  mockGetMediaLibraryPermissionsAsync.mockReset();
  mockRequestMediaLibraryPermissionsAsync.mockReset();
});

describe('mapPermissionResponse', () => {
  it('maps undetermined to not-requested', () => {
    expect(mapPermissionResponse(response({ status: 'undetermined' }))).toBe('not-requested');
  });

  it('maps granted+all to granted', () => {
    expect(mapPermissionResponse(response({ status: 'granted', accessPrivileges: 'all' }))).toBe('granted');
  });

  it('maps granted+limited to limited', () => {
    expect(mapPermissionResponse(response({ status: 'granted', accessPrivileges: 'limited' }))).toBe('limited');
  });

  it('maps denied to denied', () => {
    expect(mapPermissionResponse(response({ status: 'denied' }))).toBe('denied');
  });

  it('maps null/undefined (取得失敗) to denied (fail-closed)', () => {
    expect(mapPermissionResponse(null)).toBe('denied');
    expect(mapPermissionResponse(undefined)).toBe('denied');
  });
});

describe('usePhotoLibraryPermission (AC-018/AC-019 4状態分岐)', () => {
  it('未リクエスト時はOSダイアログ(requestを)自動的に呼び、許可されればgrantedになる', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'undetermined' }));
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'granted', accessPrivileges: 'all' }));

    const { result } = await renderHook(() => usePhotoLibraryPermission());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.state).toBe('granted');
    expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('未リクエスト→拒否された場合はdeniedになる', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'undetermined' }));
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'denied' }));

    const { result } = await renderHook(() => usePhotoLibraryPermission());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.state).toBe('denied');
  });

  it('既に許可済み(all)の場合はOSダイアログを再度出さない', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'granted', accessPrivileges: 'all' }));

    const { result } = await renderHook(() => usePhotoLibraryPermission());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.state).toBe('granted');
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('既に限定アクセスの場合はlimitedのまま、OSダイアログを出さない', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'granted', accessPrivileges: 'limited' }));

    const { result } = await renderHook(() => usePhotoLibraryPermission());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.state).toBe('limited');
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('既に拒否済みの場合はdeniedのまま、OSダイアログを出さない', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'denied' }));

    const { result } = await renderHook(() => usePhotoLibraryPermission());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.state).toBe('denied');
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('権限状態の取得自体が失敗した場合はdenied扱いにする(fail-closed)', async () => {
    mockGetMediaLibraryPermissionsAsync.mockRejectedValue(new Error('native module error'));

    const { result } = await renderHook(() => usePhotoLibraryPermission());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.state).toBe('denied');
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requestAgain()は限定状態から「他の写真を選択」を再提示するために権限を再リクエストする', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'granted', accessPrivileges: 'limited' }));
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue(response({ status: 'granted', accessPrivileges: 'all' }));

    const { result } = await renderHook(() => usePhotoLibraryPermission());
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    await act(async () => {
      await result.current.requestAgain();
    });

    await waitFor(() => expect(result.current.state).toBe('granted'));
    expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

import { useCallback, useEffect, useState } from 'react';

import * as ImagePicker from 'expo-image-picker';

// spec.md AC-018/019の4状態(未リクエスト/許可/限定/拒否)にマッピングする
export type PhotoLibraryPermissionState = 'not-requested' | 'granted' | 'limited' | 'denied';

export type UsePhotoLibraryPermissionResult = {
  state: PhotoLibraryPermissionState;
  isChecking: boolean;
  // 「限定」状態で「他の写真も追加で選べます」導線から呼ぶ。
  // iOSはlimited状態で権限を再リクエストすると「他の写真を選択」シートを再提示する。
  requestAgain: () => Promise<void>;
};

export function mapPermissionResponse(
  response: ImagePicker.MediaLibraryPermissionResponse | null | undefined
): PhotoLibraryPermissionState {
  if (!response) return 'denied';
  if (response.status === 'undetermined') return 'not-requested';
  if (response.status === 'granted') {
    return response.accessPrivileges === 'limited' ? 'limited' : 'granted';
  }
  // status === 'denied'、および想定外の値はすべて拒否側に倒す(AC-018失敗時: fail-closed)
  return 'denied';
}

export function usePhotoLibraryPermission(): UsePhotoLibraryPermissionResult {
  const [state, setState] = useState<PhotoLibraryPermissionState>('not-requested');
  const [isChecking, setIsChecking] = useState(true);

  const checkAndRequestIfNeeded = useCallback(async () => {
    setIsChecking(true);
    try {
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      const currentState = mapPermissionResponse(current);
      if (currentState === 'not-requested') {
        const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
        setState(mapPermissionResponse(requested));
      } else {
        setState(currentState);
      }
    } catch {
      setState('denied');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAndRequestIfNeeded();
  }, [checkAndRequestIfNeeded]);

  const requestAgain = useCallback(async () => {
    setIsChecking(true);
    try {
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setState(mapPermissionResponse(requested));
    } catch {
      setState('denied');
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { state, isChecking, requestAgain };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import { STORAGE_KEYS } from '../../lib/storage';
import { FREE_LIMITS, useQuota } from './useQuota';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useQuota (AC-009 残り回数表示の計算)', () => {
  it('shows full free limits when quota is unset', async () => {
    const { result } = await renderHook(() => useQuota());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.remainingPhotoAssessments).toBe(FREE_LIMITS.photoAssessments);
    expect(result.current.remainingReplyGenerations).toBe(FREE_LIMITS.replyGenerations);
  });

  it('subtracts used counts from the free limits', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.quota,
      JSON.stringify({ photoAssessmentsUsed: 2, replyGenerationsUsed: 5 })
    );

    const { result } = await renderHook(() => useQuota());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.remainingPhotoAssessments).toBe(1);
    expect(result.current.remainingReplyGenerations).toBe(0);
  });

  it('never returns a negative remaining count even if used exceeds the limit', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.quota,
      JSON.stringify({ photoAssessmentsUsed: 99, replyGenerationsUsed: 99 })
    );

    const { result } = await renderHook(() => useQuota());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.remainingPhotoAssessments).toBe(0);
    expect(result.current.remainingReplyGenerations).toBe(0);
  });
});

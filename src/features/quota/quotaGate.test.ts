import { STORAGE_KEYS } from '../../lib/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_LIMITS } from './useQuota';
import { hasRemainingQuota, incrementQuota } from './quotaGate';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('hasRemainingQuota (AC-010: ペイウォール分岐の判定)', () => {
  it('returns true when usage is below the free limit', async () => {
    expect(await hasRemainingQuota('photoAssessments')).toBe(true);
    expect(await hasRemainingQuota('replyGenerations')).toBe(true);
  });

  it('returns false once photoAssessments usage reaches the free limit', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.quota,
      JSON.stringify({ photoAssessmentsUsed: FREE_LIMITS.photoAssessments, replyGenerationsUsed: 0 })
    );
    expect(await hasRemainingQuota('photoAssessments')).toBe(false);
    expect(await hasRemainingQuota('replyGenerations')).toBe(true);
  });

  it('returns false once replyGenerations usage reaches the free limit', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.quota,
      JSON.stringify({ photoAssessmentsUsed: 0, replyGenerationsUsed: FREE_LIMITS.replyGenerations })
    );
    expect(await hasRemainingQuota('replyGenerations')).toBe(false);
  });
});

describe('incrementQuota (AC-009)', () => {
  it('increments only the targeted counter and persists it', async () => {
    await incrementQuota('photoAssessments');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.quota);
    expect(JSON.parse(raw as string)).toEqual({ photoAssessmentsUsed: 1, replyGenerationsUsed: 0 });
  });

  it('increments replyGenerations independently', async () => {
    await incrementQuota('photoAssessments');
    await incrementQuota('replyGenerations');
    await incrementQuota('replyGenerations');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.quota);
    expect(JSON.parse(raw as string)).toEqual({ photoAssessmentsUsed: 1, replyGenerationsUsed: 2 });
  });

  it('AC-009 失敗時: does not throw when the underlying write fails, and keeps the prior persisted value', async () => {
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(incrementQuota('photoAssessments')).resolves.toBeUndefined();

    setItemSpy.mockRestore();
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.quota);
    expect(raw).toBeNull();
  });
});

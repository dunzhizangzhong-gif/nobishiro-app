import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  STORAGE_KEYS,
  addAssessment,
  addReplySession,
  deleteHistory,
  getAssessments,
  getProfile,
  getQuota,
  getReplySessions,
  setProfile,
  setQuota,
} from './storage';
import type { PhotoAssessment, ReplySession } from '../types/domain';

const assessment: PhotoAssessment = {
  id: 'a1',
  createdAt: '2026-08-10T00:00:00.000Z',
  photoRefs: ['asset-1', 'asset-2'],
  recommendedIndex: 0,
  results: [
    {
      score: 4,
      reasons: ['自然光が良い'],
      improvements: [{ category: 'light', advice: '窓際で撮ると良い' }],
    },
  ],
};

const replySession: ReplySession = {
  id: 'r1',
  createdAt: '2026-08-10T00:00:00.000Z',
  inputType: 'text',
  inputText: 'こんにちは',
  tone: 'casual',
  suggestions: [{ text: 'こんにちは!', aim: '親しみやすさ' }],
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('profile/quota', () => {
  it('returns defaults when unset', async () => {
    expect(await getProfile()).toEqual({ ageConfirmedAt: null, onboardingCompletedAt: null });
    expect(await getQuota()).toEqual({ photoAssessmentsUsed: 0, replyGenerationsUsed: 0 });
  });

  it('persists and reloads profile/quota', async () => {
    await setProfile({ ageConfirmedAt: '2026-08-10T00:00:00.000Z', onboardingCompletedAt: '2026-08-10T00:00:01.000Z' });
    await setQuota({ photoAssessmentsUsed: 2, replyGenerationsUsed: 3 });

    expect(await getProfile()).toEqual({
      ageConfirmedAt: '2026-08-10T00:00:00.000Z',
      onboardingCompletedAt: '2026-08-10T00:00:01.000Z',
    });
    expect(await getQuota()).toEqual({ photoAssessmentsUsed: 2, replyGenerationsUsed: 3 });
  });
});

describe('assessments/replySessions (AC-014 非永続化)', () => {
  it('adds a new item to the front (新しい順)', async () => {
    await addAssessment(assessment);
    await addAssessment({ ...assessment, id: 'a2' });

    const items = await getAssessments();
    expect(items.map((entry) => (entry.status === 'ok' ? entry.data.id : null))).toEqual([
      'a2',
      'a1',
    ]);
  });

  it('stores only asset ID references and result text, never photo binaries', async () => {
    await addAssessment(assessment);
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.assessments);
    const stored = JSON.parse(raw as string);

    expect(Object.keys(stored[0]).sort()).toEqual(
      ['createdAt', 'id', 'photoRefs', 'recommendedIndex', 'results'].sort()
    );
    stored[0].photoRefs.forEach((ref: unknown) => expect(typeof ref).toBe('string'));
    expect(JSON.stringify(stored)).not.toMatch(/base64|data:image/i);
  });

  it('adds reply sessions to the front', async () => {
    await addReplySession(replySession);
    await addReplySession({ ...replySession, id: 'r2' });

    const items = await getReplySessions();
    expect(items.map((entry) => (entry.status === 'ok' ? entry.data.id : null))).toEqual([
      'r2',
      'r1',
    ]);
  });
});

describe('破損データの扱い(AC-012)', () => {
  it('flags a record missing required fields as corrupted while keeping valid ones visible', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.assessments,
      JSON.stringify([assessment, { id: 'broken' /* createdAt欠落 */ }])
    );

    const items = await getAssessments();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ status: 'ok', data: assessment });
    expect(items[1].status).toBe('corrupted');
  });

  it('flags a record with wrong field types as corrupted', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.assessments,
      JSON.stringify([{ id: 'a3', createdAt: '2026-08-10', photoRefs: 'not-an-array', recommendedIndex: 0, results: [] }])
    );

    const items = await getAssessments();
    expect(items).toEqual([{ status: 'corrupted', raw: expect.any(Object) }]);
  });

  it('returns an empty list (not a throw) when the whole stored value is unparsable JSON', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.assessments, 'not json{{{');

    await expect(getAssessments()).resolves.toEqual([]);
  });

  it('keeps a previously corrupted record in storage when a new item is added', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.assessments, JSON.stringify([{ id: 'broken' }]));

    await addAssessment(assessment);

    const items = await getAssessments();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ status: 'ok', data: assessment });
    expect(items[1].status).toBe('corrupted');
  });
});

describe('deleteHistory (AC-020)', () => {
  it('clears assessments and replySessions but preserves profile/quota', async () => {
    await setProfile({ ageConfirmedAt: '2026-08-10T00:00:00.000Z', onboardingCompletedAt: null });
    await setQuota({ photoAssessmentsUsed: 1, replyGenerationsUsed: 1 });
    await addAssessment(assessment);
    await addReplySession(replySession);

    await deleteHistory();

    expect(await getAssessments()).toEqual([]);
    expect(await getReplySessions()).toEqual([]);
    expect(await getProfile()).toEqual({
      ageConfirmedAt: '2026-08-10T00:00:00.000Z',
      onboardingCompletedAt: null,
    });
    expect(await getQuota()).toEqual({ photoAssessmentsUsed: 1, replyGenerationsUsed: 1 });
  });
});

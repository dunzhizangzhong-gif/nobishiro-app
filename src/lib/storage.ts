import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PhotoAssessment, Profile, Quota, ReplySession } from '../types/domain';

export const STORAGE_KEYS = {
  profile: 'nobishiro:profile',
  quota: 'nobishiro:quota',
  assessments: 'nobishiro:assessments',
  replySessions: 'nobishiro:replySessions',
} as const;

const DEFAULT_PROFILE: Profile = {
  ageConfirmedAt: null,
  onboardingCompletedAt: null,
};

const DEFAULT_QUOTA: Quota = {
  photoAssessmentsUsed: 0,
  replyGenerationsUsed: 0,
};

export type StoredRecord<T> = { status: 'ok'; data: T } | { status: 'corrupted'; raw: unknown };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasRequiredBaseFields(value: unknown): value is { id: string; createdAt: string } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id) && isNonEmptyString(record.createdAt);
}

function isPhotoAssessment(value: unknown): value is PhotoAssessment {
  if (!hasRequiredBaseFields(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.photoRefs) &&
    typeof record.recommendedIndex === 'number' &&
    Array.isArray(record.results)
  );
}

function isReplySession(value: unknown): value is ReplySession {
  if (!hasRequiredBaseFields(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.inputType === 'screenshot' || record.inputType === 'text') &&
    typeof record.inputText === 'string' &&
    Array.isArray(record.suggestions)
  );
}

// 配列全体のJSON.parseが失敗した場合は個々のレコードを復元できないため、
// 一覧を破損扱いで全滅させず空配列として返す(AC-012: 一覧自体は表示する、との整合)。
function parseStoredArray<T>(
  raw: string | null,
  isValid: (value: unknown) => value is T
): StoredRecord<T>[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) =>
    isValid(item) ? { status: 'ok', data: item } : { status: 'corrupted', raw: item }
  );
}

export async function getProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.profile);
  if (raw === null) return DEFAULT_PROFILE;
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function setProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

export async function getQuota(): Promise<Quota> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.quota);
  if (raw === null) return DEFAULT_QUOTA;
  try {
    return { ...DEFAULT_QUOTA, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_QUOTA;
  }
}

export async function setQuota(quota: Quota): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.quota, JSON.stringify(quota));
}

export async function getAssessments(): Promise<StoredRecord<PhotoAssessment>[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.assessments);
  return parseStoredArray(raw, isPhotoAssessment);
}

function toStoredValue<T>(entry: StoredRecord<T>): unknown {
  return entry.status === 'ok' ? entry.data : entry.raw;
}

export async function addAssessment(assessment: PhotoAssessment): Promise<void> {
  const existing = await getAssessments();
  await AsyncStorage.setItem(
    STORAGE_KEYS.assessments,
    JSON.stringify([assessment, ...existing.map(toStoredValue)])
  );
}

export async function getReplySessions(): Promise<StoredRecord<ReplySession>[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.replySessions);
  return parseStoredArray(raw, isReplySession);
}

export async function addReplySession(session: ReplySession): Promise<void> {
  const existing = await getReplySessions();
  await AsyncStorage.setItem(
    STORAGE_KEYS.replySessions,
    JSON.stringify([session, ...existing.map(toStoredValue)])
  );
}

export async function deleteHistory(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEYS.assessments, STORAGE_KEYS.replySessions]);
}

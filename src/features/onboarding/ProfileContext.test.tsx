import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { STORAGE_KEYS } from '../../lib/storage';
import { ProfileProvider, useProfile } from './ProfileContext';

const wrapper = ({ children }: PropsWithChildren) => <ProfileProvider>{children}</ProfileProvider>;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('ProfileContext (AC-013の土台)', () => {
  it('starts with no age confirmation and finishes loading', async () => {
    const { result } = await renderHook(() => useProfile(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile.ageConfirmedAt).toBeNull();
  });

  it('records ageConfirmedAt/onboardingCompletedAt only when confirming as an adult', async () => {
    const { result } = await renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.confirmAge(true);
    });

    await waitFor(() => expect(result.current.profile.ageConfirmedAt).not.toBeNull());
    expect(result.current.profile.onboardingCompletedAt).not.toBeNull();

    const persisted = await AsyncStorage.getItem(STORAGE_KEYS.profile);
    expect(JSON.parse(persisted as string).ageConfirmedAt).not.toBeNull();
  });

  it('does not record anything when the user answers under 18', async () => {
    const { result } = await renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.confirmAge(false);
    });

    expect(result.current.profile.ageConfirmedAt).toBeNull();
    const persisted = await AsyncStorage.getItem(STORAGE_KEYS.profile);
    expect(persisted).toBeNull();
  });
});

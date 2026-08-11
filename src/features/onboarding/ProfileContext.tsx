import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getProfile, setProfile as persistProfile } from '../../lib/storage';
import type { Profile } from '../../types/domain';

type ProfileContextValue = {
  profile: Profile;
  isLoading: boolean;
  confirmAge: (isAdult: boolean) => Promise<void>;
};

const DEFAULT_PROFILE: Profile = { ageConfirmedAt: null, onboardingCompletedAt: null };

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProfile().then((loaded) => {
      if (!active) return;
      setProfileState(loaded);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const confirmAge = async (isAdult: boolean) => {
    // 18歳未満はProfileを更新しない(spec.md AC-013: ageConfirmedAtが記録されるのは18歳以上選択時のみ)
    if (!isAdult) return;
    const now = new Date().toISOString();
    const next: Profile = { ageConfirmedAt: now, onboardingCompletedAt: now };
    await persistProfile(next);
    setProfileState(next);
  };

  const value = useMemo(() => ({ profile, isLoading, confirmAge }), [profile, isLoading]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return ctx;
}

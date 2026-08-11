import { Stack } from 'expo-router';

import { PhotoAssessmentSessionProvider } from '../../src/features/photo-assessment/PhotoAssessmentSessionContext';

export default function PhotoAssessmentLayout() {
  return (
    <PhotoAssessmentSessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PhotoAssessmentSessionProvider>
  );
}

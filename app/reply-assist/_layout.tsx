import { Stack } from 'expo-router';

import { ReplyAssistSessionProvider } from '../../src/features/reply-assist/ReplyAssistSessionContext';

export default function ReplyAssistLayout() {
  return (
    <ReplyAssistSessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ReplyAssistSessionProvider>
  );
}

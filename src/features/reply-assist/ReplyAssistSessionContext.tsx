import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { ReplyTone } from '../../types/domain';
import type { ReplyAssistRequest } from '../../lib/api/replyAssistClient';

type ReplyAssistSessionValue = {
  pendingRequest: ReplyAssistRequest | null;
  tone: ReplyTone;
  setTone: (tone: ReplyTone) => void;
  submitText: (text: string) => void;
  submitScreenshot: (screenshot: { uri: string; fileName?: string | null; mimeType?: string | null }) => void;
};

const ReplyAssistSessionContext = createContext<ReplyAssistSessionValue | null>(null);

export function ReplyAssistSessionProvider({ children }: PropsWithChildren) {
  const [pendingRequest, setPendingRequest] = useState<ReplyAssistRequest | null>(null);
  const [tone, setTone] = useState<ReplyTone>(null);

  const value = useMemo<ReplyAssistSessionValue>(
    () => ({
      pendingRequest,
      tone,
      setTone,
      submitText: (text) => setPendingRequest({ inputType: 'text', text, tone }),
      submitScreenshot: (screenshot) => setPendingRequest({ inputType: 'screenshot', screenshot, tone }),
    }),
    [pendingRequest, tone]
  );

  return <ReplyAssistSessionContext.Provider value={value}>{children}</ReplyAssistSessionContext.Provider>;
}

export function useReplyAssistSession(): ReplyAssistSessionValue {
  const ctx = useContext(ReplyAssistSessionContext);
  if (!ctx) {
    throw new Error('useReplyAssistSession must be used within ReplyAssistSessionProvider');
  }
  return ctx;
}

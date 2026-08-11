import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useReplyAssistSession } from '../../src/features/reply-assist/ReplyAssistSessionContext';
import { useReplyAssistSubmission } from '../../src/features/reply-assist/useReplyAssistSubmission';
import { useEntitlement } from '../../src/features/paywall/useEntitlement';
import { trackEvent } from '../../src/lib/analytics';
import { getReplySessions } from '../../src/lib/storage';
import type { ReplySession, ReplySuggestion } from '../../src/types/domain';

const EXPECTED_SUGGESTION_COUNT = 3;

function SuggestionCard({ suggestion, index }: { suggestion: ReplySuggestion; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(suggestion.text);
    // AC-015: reply_copied
    trackEvent({ name: 'reply_copied' });
    setCopied(true);
  };

  return (
    <View testID={`reply-result-card-${index}`} style={styles.card}>
      <Text testID={`reply-result-aim-${index}`} style={styles.aim}>
        {suggestion.aim}
      </Text>
      <Text testID={`reply-result-text-${index}`} style={styles.suggestionText}>
        {suggestion.text}
      </Text>
      <Pressable testID={`reply-result-copy-${index}`} style={styles.copyButton} onPress={handleCopy}>
        <Text style={styles.copyButtonText}>{copied ? 'コピーしました' : 'コピー'}</Text>
      </Pressable>
    </View>
  );
}

function SuccessResultView({
  sessionId,
  onRegenerate,
}: {
  sessionId: string;
  onRegenerate?: () => void;
}) {
  const [session, setSession] = useState<ReplySession | 'loading' | 'not-found'>('loading');

  useEffect(() => {
    let active = true;
    getReplySessions().then((entries) => {
      if (!active) return;
      const match = entries.find((entry) => entry.status === 'ok' && entry.data.id === sessionId);
      setSession(match && match.status === 'ok' ? match.data : 'not-found');
    });
    return () => {
      active = false;
    };
  }, [sessionId]);

  if (session === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (session === 'not-found') {
    return (
      <View style={styles.centered}>
        <Text testID="reply-result-not-found" style={styles.message}>
          結果を表示できませんでした
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>返信案</Text>

      {session.suggestions.map((suggestion, index) => (
        <SuggestionCard key={index} suggestion={suggestion} index={index} />
      ))}

      {onRegenerate && session.suggestions.length < EXPECTED_SUGGESTION_COUNT && (
        <Pressable testID="reply-result-regenerate" style={styles.button} onPress={onRegenerate}>
          <Text style={styles.buttonText}>再生成</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

export default function ReplyAssistResult() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { pendingRequest } = useReplyAssistSession();
  const { isPro } = useEntitlement();
  const isHistoryView = Boolean(id);
  // AC-011: サブスク中は無料枠を消費しない。履歴からの表示(id指定)では送信自体を行わない
  const { phase, retry, cancel } = useReplyAssistSubmission(isHistoryView ? null : pendingRequest, {
    consumesQuota: !isPro,
  });

  // AC-012: 履歴(S-9)からの詳細再表示。送信フックは起動せず、保存済みセッションをそのまま表示する
  if (isHistoryView) {
    return <SuccessResultView sessionId={id as string} />;
  }

  if (!pendingRequest) {
    return (
      <View style={styles.centered}>
        <Text testID="reply-result-not-found" style={styles.message}>
          結果を表示できませんでした
        </Text>
      </View>
    );
  }

  if (phase.status === 'pending') {
    return (
      <View style={styles.centered} testID="reply-result-processing">
        <ActivityIndicator size="large" />
        <Text style={styles.message}>返信案を考えています</Text>
        <Pressable
          testID="reply-result-cancel"
          style={styles.cancelButton}
          onPress={() => {
            cancel();
            router.back();
          }}
        >
          <Text style={styles.cancelButtonText}>キャンセル</Text>
        </Pressable>
      </View>
    );
  }

  if (phase.status === 'unreadable') {
    return (
      <View style={styles.centered}>
        <Text testID="reply-result-unreadable" style={styles.message}>
          会話を読み取れませんでした
        </Text>
        <Pressable
          testID="reply-result-go-to-text"
          style={styles.button}
          onPress={() => router.replace('/reply-assist/input')}
        >
          <Text style={styles.buttonText}>テキストで入力する</Text>
        </Pressable>
      </View>
    );
  }

  if (phase.status === 'timeout' || phase.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text testID="reply-result-error-message" style={styles.message}>
          {phase.status === 'timeout' ? 'タイムアウトしました。もう一度お試しください。' : phase.message}
        </Text>
        <Pressable testID="reply-result-retry" style={styles.button} onPress={retry}>
          <Text style={styles.buttonText}>再試行</Text>
        </Pressable>
      </View>
    );
  }

  // AC-023: レート制限超過。無料枠は消費されていない
  if (phase.status === 'rate_limited') {
    return (
      <View style={styles.centered}>
        <Text testID="reply-result-rate-limited" style={styles.message}>
          アクセスが集中しています。しばらくしてから再度お試しください
        </Text>
        <Pressable testID="reply-result-back" style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  // AC-022(S-7): モデレーション判定で不適切と判定された。無料枠は消費されていない
  if (phase.status === 'guideline_violation') {
    return (
      <View style={styles.centered}>
        <Text testID="reply-result-guideline-violation" style={styles.message}>
          アップロードされた内容がガイドラインに違反していると判定されました
        </Text>
        <Pressable testID="reply-result-back" style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  if (phase.status === 'success') {
    return <SuccessResultView sessionId={phase.sessionId} onRegenerate={retry} />;
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  aim: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
  },
  suggestionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  copyButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

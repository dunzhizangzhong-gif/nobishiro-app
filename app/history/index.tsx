import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { trackEvent } from '../../src/lib/analytics';
import { getAssessments, getReplySessions, type StoredRecord } from '../../src/lib/storage';
import type { PhotoAssessment, ReplySession } from '../../src/types/domain';

type HistoryItem =
  | { kind: 'photo'; entry: StoredRecord<PhotoAssessment> }
  | { kind: 'reply'; entry: StoredRecord<ReplySession> };

function sortKey(item: HistoryItem): string {
  return item.entry.status === 'ok' ? item.entry.data.createdAt : '';
}

type LoadState = 'loading' | { items: HistoryItem[] };

export default function History() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    const [assessments, replies] = await Promise.all([getAssessments(), getReplySessions()]);
    const items: HistoryItem[] = [
      ...assessments.map((entry): HistoryItem => ({ kind: 'photo', entry })),
      ...replies.map((entry): HistoryItem => ({ kind: 'reply', entry })),
    ].sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : sortKey(a) > sortKey(b) ? -1 : 0));
    setState({ items });
  }, []);

  useEffect(() => {
    load();
    // AC-015: history_viewed
    trackEvent({ name: 'history_viewed' });
  }, [load]);

  // AC-012: 判定/返信の実行後に履歴へ戻った際、一覧を最新化する
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (state === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  // DL-009: 判定・返信いずれも0件の場合は空状態ビューを表示する
  if (state.items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text testID="history-empty" style={styles.emptyMessage}>
          まだ履歴がありません。写真判定や返信支援を試してみましょう。
        </Text>
        <Pressable testID="history-empty-cta" style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>ホームへ戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>履歴</Text>

      {state.items.map((item, index) => {
        if (item.entry.status === 'corrupted') {
          return (
            <View key={index} testID={`history-item-corrupted-${index}`} style={styles.row}>
              <Text style={styles.corruptedText}>表示できません</Text>
            </View>
          );
        }

        const data = item.entry.data;
        if (item.kind === 'photo') {
          return (
            <Pressable
              key={data.id}
              testID={`history-item-photo-${data.id}`}
              style={styles.row}
              onPress={() => router.push(`/photo-assessment/result?id=${data.id}`)}
            >
              <Text style={styles.rowLabel}>写真判定</Text>
              <Text style={styles.rowDate}>{data.createdAt}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={data.id}
            testID={`history-item-reply-${data.id}`}
            style={styles.row}
            onPress={() => router.push(`/reply-assist/result?id=${data.id}`)}
          >
            <Text style={styles.rowLabel}>返信支援</Text>
            <Text style={styles.rowDate}>{data.createdAt}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
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
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
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
  row: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowDate: {
    fontSize: 12,
    color: '#777777',
  },
  corruptedText: {
    fontSize: 14,
    color: '#999999',
  },
});

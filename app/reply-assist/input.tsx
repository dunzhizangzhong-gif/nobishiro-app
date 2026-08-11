import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LimitedAccessBanner } from '../../src/features/permissions/LimitedAccessBanner';
import { PermissionDeniedView } from '../../src/features/permissions/PermissionDeniedView';
import { usePhotoLibraryPermission } from '../../src/features/permissions/usePhotoLibraryPermission';
import { useReplyAssistSession } from '../../src/features/reply-assist/ReplyAssistSessionContext';
import { MAX_TEXT_LENGTH, isValidReplyText } from '../../src/features/reply-assist/validation';
import { isOnline } from '../../src/lib/network';
import type { ReplyTone } from '../../src/types/domain';

type Tab = 'text' | 'screenshot';

const TONE_OPTIONS: { value: Exclude<ReplyTone, null>; label: string }[] = [
  { value: 'polite', label: '丁寧' },
  { value: 'casual', label: 'カジュアル' },
  { value: 'humorous', label: 'ユーモア' },
];

function ToneSelector({ tone, onChange }: { tone: ReplyTone; onChange: (tone: ReplyTone) => void }) {
  return (
    <View style={styles.toneRow}>
      {TONE_OPTIONS.map((option) => {
        const selected = tone === option.value;
        return (
          <Pressable
            key={option.value}
            testID={`reply-input-tone-${option.value}`}
            style={[styles.toneChip, selected && styles.toneChipSelected]}
            onPress={() => onChange(selected ? null : option.value)}
          >
            <Text style={[styles.toneChipText, selected && styles.toneChipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScreenshotTab({ onSubmit }: { onSubmit: () => void }) {
  const permission = usePhotoLibraryPermission();
  const { submitScreenshot } = useReplyAssistSession();
  const [selected, setSelected] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [offlineError, setOfflineError] = useState(false);

  if (permission.isChecking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (permission.state === 'denied') {
    return <PermissionDeniedView showTextFallbackHint />;
  }

  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled && result.assets[0]) {
      setSelected(result.assets[0]);
      setOfflineError(false);
    }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const online = await isOnline();
    if (!online) {
      setOfflineError(true);
      return;
    }
    setOfflineError(false);
    submitScreenshot({ uri: selected.uri, fileName: selected.fileName, mimeType: selected.mimeType });
    onSubmit();
  };

  return (
    <View style={styles.tabContent}>
      {permission.state === 'limited' && <LimitedAccessBanner onSelectMore={permission.requestAgain} />}

      <Pressable testID="reply-input-pick-screenshot" style={styles.pickButton} onPress={handlePick}>
        <Text style={styles.pickButtonText}>{selected ? 'スクショを選び直す' : 'スクショを選ぶ'}</Text>
      </Pressable>

      {selected && <Text testID="reply-input-screenshot-selected">選択済み</Text>}
      {offlineError && (
        <Text testID="reply-input-offline-message" style={styles.validationMessage}>
          オフラインです。接続を確認してから再度お試しください。
        </Text>
      )}

      <Pressable
        testID="reply-input-submit-screenshot"
        disabled={!selected}
        style={[styles.submitButton, !selected && styles.submitButtonDisabled]}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>送信する</Text>
      </Pressable>
    </View>
  );
}

function TextTab({ onSubmit }: { onSubmit: () => void }) {
  const { submitText } = useReplyAssistSession();
  const [text, setText] = useState('');
  const [offlineError, setOfflineError] = useState(false);
  const canSubmit = isValidReplyText(text);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const online = await isOnline();
    if (!online) {
      setOfflineError(true);
      return;
    }
    setOfflineError(false);
    submitText(text);
    onSubmit();
  };

  return (
    <View style={styles.tabContent}>
      <TextInput
        testID="reply-input-text-field"
        style={styles.textInput}
        multiline
        placeholder="相手からのメッセージを貼り付けてください"
        value={text}
        onChangeText={setText}
      />
      <Text testID="reply-input-char-count" style={styles.charCount}>
        {text.length} / {MAX_TEXT_LENGTH}
      </Text>

      {!canSubmit && (
        <Text testID="reply-input-validation-message" style={styles.validationMessage}>
          1〜{MAX_TEXT_LENGTH}文字で入力してください
        </Text>
      )}
      {offlineError && (
        <Text testID="reply-input-offline-message" style={styles.validationMessage}>
          オフラインです。接続を確認してから再度お試しください。
        </Text>
      )}

      <Pressable
        testID="reply-input-submit-text"
        disabled={!canSubmit}
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>送信する</Text>
      </Pressable>
    </View>
  );
}

export default function ReplyAssistInput() {
  const router = useRouter();
  const { tone, setTone } = useReplyAssistSession();
  const [activeTab, setActiveTab] = useState<Tab>('text');

  const goToResult = () => router.push('/reply-assist/result');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>返信を考えてもらう</Text>

      <View style={styles.tabBar}>
        <Pressable
          testID="reply-input-tab-text"
          style={[styles.tabButton, activeTab === 'text' && styles.tabButtonActive]}
          onPress={() => setActiveTab('text')}
        >
          <Text style={styles.tabButtonText}>テキスト</Text>
        </Pressable>
        <Pressable
          testID="reply-input-tab-screenshot"
          style={[styles.tabButton, activeTab === 'screenshot' && styles.tabButtonActive]}
          onPress={() => setActiveTab('screenshot')}
        >
          <Text style={styles.tabButtonText}>スクショ</Text>
        </Pressable>
      </View>

      <ToneSelector tone={tone} onChange={setTone} />

      {activeTab === 'text' ? <TextTab onSubmit={goToResult} /> : <ScreenshotTab onSubmit={goToResult} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#F0F0F0',
  },
  tabButtonActive: {
    backgroundColor: '#111111',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  toneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toneChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  toneChipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  toneChipText: {
    fontSize: 13,
    color: '#111111',
  },
  toneChipTextSelected: {
    color: '#FFFFFF',
  },
  tabContent: {
    gap: 12,
  },
  textInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'right',
  },
  pickButton: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  validationMessage: {
    fontSize: 14,
    color: '#B00020',
  },
  submitButton: {
    backgroundColor: '#111111',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

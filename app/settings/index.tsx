import { useRouter } from 'expo-router';
import { useState } from 'react';
import Purchases from 'react-native-purchases';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEntitlement } from '../../src/features/paywall/useEntitlement';
import { deleteHistory } from '../../src/lib/storage';

const SUBSCRIPTION_MANAGEMENT_URL = 'https://apps.apple.com/account/subscriptions';
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;

function SettingsRow({
  testID,
  label,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable testID={testID} disabled={disabled} style={styles.row} onPress={onPress}>
      <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
        {label}
        {disabled ? '(準備中)' : ''}
      </Text>
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const entitlement = useEntitlement();
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const handleRestore = async () => {
    setRestoreError(null);
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await entitlement.refresh();
    } catch {
      setRestoreError('復元に失敗しました');
    } finally {
      setRestoring(false);
    }
  };

  const performDelete = async () => {
    await deleteHistory();
    setDeleted(true);
  };

  const handleDeletePress = () => {
    // AC-020: 確認ダイアログで「削除する」を選択した場合のみ削除する。キャンセル時は何もしない
    Alert.alert('データを削除しますか?', '判定履歴・返信履歴を削除します。この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: performDelete },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>設定</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>サブスク</Text>
        <SettingsRow
          testID="settings-manage-subscription"
          label="サブスクを管理"
          onPress={() => Linking.openURL(SUBSCRIPTION_MANAGEMENT_URL)}
        />
        <SettingsRow
          testID="settings-restore"
          label={restoring ? '復元中...' : '購入を復元'}
          disabled={restoring}
          onPress={handleRestore}
        />
        {restoreError && (
          <Text testID="settings-restore-error" style={styles.errorText}>
            {restoreError}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>法務</Text>
        <SettingsRow
          testID="settings-privacy-policy"
          label="プライバシーポリシー"
          disabled={!PRIVACY_POLICY_URL}
          onPress={() => PRIVACY_POLICY_URL && Linking.openURL(PRIVACY_POLICY_URL)}
        />
        <SettingsRow
          testID="settings-terms"
          label="利用規約"
          disabled={!TERMS_URL}
          onPress={() => TERMS_URL && Linking.openURL(TERMS_URL)}
        />
        <SettingsRow
          testID="settings-licenses-link"
          label="ライセンス表記"
          onPress={() => router.push('/settings/licenses')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>データ</Text>
        <SettingsRow testID="settings-delete-button" label="データ削除" onPress={handleDeletePress} />
        {deleted && (
          <Text testID="settings-delete-success" style={styles.successText}>
            履歴データを削除しました
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#777777',
    textTransform: 'uppercase',
  },
  row: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowLabelDisabled: {
    color: '#AAAAAA',
  },
  errorText: {
    fontSize: 13,
    color: '#B00020',
  },
  successText: {
    fontSize: 13,
    color: '#1B7F3A',
  },
});

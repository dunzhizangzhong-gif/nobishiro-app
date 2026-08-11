import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  // AC-019: スクショタブ拒否時はテキスト入力タブへの誘導を併記する
  showTextFallbackHint?: boolean;
};

export function PermissionDeniedView({ showTextFallbackHint = false }: Props) {
  return (
    <View style={styles.container} testID="photo-permission-denied">
      <Text style={styles.title}>写真へのアクセスが許可されていません</Text>
      <Text style={styles.body}>設定アプリから、本アプリの写真ライブラリへのアクセスを許可してください。</Text>
      {showTextFallbackHint && (
        <Text testID="photo-permission-denied-text-hint" style={styles.hint}>
          テキストを貼り付けるタブからも返信案を作成できます。
        </Text>
      )}
      <Pressable
        testID="photo-permission-open-settings"
        style={styles.button}
        onPress={() => Linking.openSettings()}
      >
        <Text style={styles.buttonText}>設定を開く</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    color: '#555555',
  },
  button: {
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

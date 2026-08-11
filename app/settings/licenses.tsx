import { ScrollView, StyleSheet, Text, View } from 'react-native';

// STEP4実装時点(T14)では依存ライブラリのライセンス一覧生成ツールを未導入。
// 実際のライセンス一覧生成は release-checklist.md の追跡項目として別途対応する
// (spec.md 10章 DoD項目7)。ここではライセンス表記画面自体の到達性のみ担保する。
export default function Licenses() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ライセンス表記</Text>
      <View testID="licenses-placeholder">
        <Text style={styles.message}>準備中です。使用ライブラリのライセンス一覧は今後追加されます。</Text>
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
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555555',
  },
});

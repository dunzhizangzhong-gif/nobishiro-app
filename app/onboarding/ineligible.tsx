import { StyleSheet, Text, View } from 'react-native';

export default function Ineligible() {
  return (
    <View style={styles.container} testID="onboarding-ineligible">
      <Text style={styles.title}>ご利用いただけません</Text>
      <Text style={styles.body}>
        本アプリは18歳以上の方のみご利用いただけます。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});

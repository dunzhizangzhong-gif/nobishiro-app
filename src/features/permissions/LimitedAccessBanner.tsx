import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onSelectMore: () => void;
};

export function LimitedAccessBanner({ onSelectMore }: Props) {
  return (
    <View style={styles.container} testID="photo-permission-limited-banner">
      <Text style={styles.text}>他の写真も追加で選べます</Text>
      <Pressable testID="photo-permission-select-more" onPress={onSelectMore}>
        <Text style={styles.link}>選択する写真を変更</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 8,
  },
  text: {
    fontSize: 13,
    color: '#333333',
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

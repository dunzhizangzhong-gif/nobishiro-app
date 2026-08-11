import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getReferenceImagesForCategory } from '../../../src/features/photo-assessment/referenceImages';
import { trackEvent } from '../../../src/lib/analytics';

const PLACEHOLDER_COLORS: Record<string, string> = {
  light: '#FFE9A8',
  composition: '#B8E0D2',
  expression: '#F7C5CC',
  outfit: '#C9D6EA',
  background: '#D8D2F0',
  other: '#E0E0E0',
};

export default function ReferenceImageScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const images = getReferenceImagesForCategory(category ?? 'other');

  useEffect(() => {
    // AC-015: reference_viewed
    trackEvent({ name: 'reference_viewed' });
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>参考イメージ</Text>

      {images.map((image) => (
        <View key={image.id} testID={`reference-image-card-${image.id}`} style={styles.card}>
          <View
            testID={`reference-image-placeholder-${image.id}`}
            style={[styles.illustration, { backgroundColor: PLACEHOLDER_COLORS[image.category] ?? '#E0E0E0' }]}
          />
          <Text testID={`reference-caption-${image.id}`} style={styles.caption}>
            {image.caption}
          </Text>
        </View>
      ))}
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
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  card: {
    gap: 12,
  },
  illustration: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
  },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePhotoThumbnail } from '../../src/features/photo-assessment/usePhotoThumbnail';
import { getAssessments } from '../../src/lib/storage';
import type { PhotoAssessment, PhotoAssessmentResult as PhotoAssessmentResultItem } from '../../src/types/domain';

type LoadState =
  | { status: 'loading' }
  | { status: 'found'; assessment: PhotoAssessment }
  | { status: 'not-found' };

function ResultThumbnail({ photoRef, index }: { photoRef: string | undefined; index: number }) {
  const uri = usePhotoThumbnail(photoRef);

  return (
    <View testID={`photo-result-thumbnail-${index}`} style={styles.thumbnailWrap}>
      {uri === undefined && <ActivityIndicator size="small" />}
      {uri === null && <View testID={`photo-result-thumbnail-placeholder-${index}`} style={styles.thumbnailPlaceholder} />}
      {typeof uri === 'string' && (
        <Image testID={`photo-result-thumbnail-image-${index}`} source={{ uri }} style={styles.thumbnail} />
      )}
    </View>
  );
}

function ResultCard({
  result,
  index,
  isRecommended,
  photoRef,
  onPressImprovement,
}: {
  result: PhotoAssessmentResultItem;
  index: number;
  isRecommended: boolean;
  photoRef: string | undefined;
  onPressImprovement: (category: string) => void;
}) {
  return (
    <View testID={`photo-result-card-${index}`} style={styles.card}>
      <View style={styles.cardHeader}>
        <ResultThumbnail photoRef={photoRef} index={index} />
        <View style={styles.cardHeaderText}>
          {isRecommended && (
            <Text testID={`photo-result-recommended-badge-${index}`} style={styles.recommendedBadge}>
              おすすめ
            </Text>
          )}
          <Text testID={`photo-result-score-${index}`} style={styles.score}>
            スコア: {result.score} / 5
          </Text>
        </View>
      </View>

      {result.reasons.map((reason, reasonIndex) => (
        <Text key={reasonIndex} testID={`photo-result-reason-${index}-${reasonIndex}`} style={styles.reason}>
          ・{reason}
        </Text>
      ))}

      {result.improvements.map((improvement, improvementIndex) => (
        <Pressable
          key={improvementIndex}
          testID={`photo-result-improvement-${index}-${improvementIndex}`}
          style={styles.improvement}
          onPress={() => onPressImprovement(improvement.category)}
        >
          <Text style={styles.improvementText}>{improvement.advice}</Text>
          <Text style={styles.referenceLink}>参考イメージを見る</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function PhotoAssessmentResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    getAssessments().then((entries) => {
      if (!active) return;
      const match = entries.find((entry) => entry.status === 'ok' && entry.data.id === id);
      setState(
        match && match.status === 'ok' ? { status: 'found', assessment: match.data } : { status: 'not-found' }
      );
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === 'not-found') {
    return (
      <View style={styles.centered}>
        <Text testID="photo-result-not-found" style={styles.message}>
          結果を表示できませんでした
        </Text>
      </View>
    );
  }

  const { assessment } = state;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>判定結果</Text>

      {!!assessment.excludedCount && assessment.excludedCount > 0 && (
        <View testID="photo-result-excluded-banner" style={styles.excludedBanner}>
          <Text style={styles.excludedBannerText}>
            {assessment.excludedCount}枚の写真は判定対象から除外されました
          </Text>
        </View>
      )}

      {assessment.results.map((result, index) => (
        <ResultCard
          key={index}
          result={result}
          index={index}
          isRecommended={index === assessment.recommendedIndex}
          photoRef={assessment.photoRefs[index]}
          onPressImprovement={(category) => router.push(`/photo-assessment/reference/${category}`)}
        />
      ))}
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
  },
  message: {
    fontSize: 16,
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
  excludedBanner: {
    backgroundColor: '#FFF4E5',
    borderRadius: 10,
    padding: 12,
  },
  excludedBannerText: {
    fontSize: 14,
    color: '#8A5A00',
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  thumbnailWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  thumbnail: {
    width: 64,
    height: 64,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: '#E0E0E0',
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  score: {
    fontSize: 16,
    fontWeight: '700',
  },
  reason: {
    fontSize: 14,
    color: '#333333',
  },
  improvement: {
    marginTop: 4,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    gap: 4,
  },
  improvementText: {
    fontSize: 14,
  },
  referenceLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePhotoAssessmentSession } from '../../src/features/photo-assessment/PhotoAssessmentSessionContext';
import { usePhotoAssessmentSubmission } from '../../src/features/photo-assessment/usePhotoAssessmentSubmission';
import { useEntitlement } from '../../src/features/paywall/useEntitlement';
import type { SelectedPhoto } from '../../src/lib/api/photoAssessmentClient';

export default function PhotoAssessmentProcessing() {
  const router = useRouter();
  const { selectedAssets } = usePhotoAssessmentSession();
  const { isPro } = useEntitlement();

  const photos: SelectedPhoto[] = selectedAssets.map((asset) => ({
    uri: asset.uri,
    assetId: asset.assetId ?? null,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  }));

  // AC-011: サブスク中は無料枠を消費しない(entitlement確認中は未確定のためローカル無料枠判定と
  // 同様に消費側にフォールバックする)
  const { phase, retry, cancel } = usePhotoAssessmentSubmission(photos, { consumesQuota: !isPro });

  useEffect(() => {
    if (phase.status === 'success') {
      router.replace(`/photo-assessment/result?id=${phase.assessmentId}`);
    }
  }, [phase, router]);

  const handleCancel = () => {
    cancel();
    router.back();
  };

  if (phase.status === 'timeout' || phase.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text testID="photo-assessment-error-message" style={styles.message}>
          {phase.status === 'timeout' ? 'タイムアウトしました。もう一度お試しください。' : phase.message}
        </Text>
        <Pressable testID="photo-assessment-retry" style={styles.button} onPress={retry}>
          <Text style={styles.buttonText}>再試行</Text>
        </Pressable>
      </View>
    );
  }

  // AC-023: レート制限超過。無料枠は消費されていない
  if (phase.status === 'rate_limited') {
    return (
      <View style={styles.centered}>
        <Text testID="photo-assessment-rate-limited" style={styles.message}>
          アクセスが集中しています。しばらくしてから再度お試しください
        </Text>
        <Pressable testID="photo-assessment-back" style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  // AC-022: バッチ内の写真が全てモデレーション判定で除外された(全滅)。無料枠は消費されていない
  if (phase.status === 'guideline_violation') {
    return (
      <View style={styles.centered}>
        <Text testID="photo-assessment-guideline-violation" style={styles.message}>
          アップロードされた写真がガイドラインに違反していると判定されました
        </Text>
        <Pressable testID="photo-assessment-back" style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>写真を選び直す</Text>
        </Pressable>
      </View>
    );
  }

  // AC-024: バッチ内の写真から人物を検出できず全滅した。無料枠は消費されていない
  if (phase.status === 'no_person_detected') {
    return (
      <View style={styles.centered}>
        <Text testID="photo-assessment-no-person-detected" style={styles.message}>
          人物が写っている写真を選んでください
        </Text>
        <Pressable testID="photo-assessment-back" style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>写真を選び直す</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.centered} testID="photo-assessment-processing">
      <ActivityIndicator size="large" />
      <Text style={styles.message}>判定には数十秒ほどかかります</Text>
      <Pressable testID="photo-assessment-cancel" style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>キャンセル</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  message: {
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

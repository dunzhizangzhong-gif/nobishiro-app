import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LimitedAccessBanner } from '../../src/features/permissions/LimitedAccessBanner';
import { PermissionDeniedView } from '../../src/features/permissions/PermissionDeniedView';
import { usePhotoLibraryPermission } from '../../src/features/permissions/usePhotoLibraryPermission';
import { MAX_PHOTOS, isValidSelectionCount } from '../../src/features/photo-assessment/validation';
import { usePhotoAssessmentSession } from '../../src/features/photo-assessment/PhotoAssessmentSessionContext';
import { isOnline } from '../../src/lib/network';

export default function PhotoAssessmentSelect() {
  const router = useRouter();
  const permission = usePhotoLibraryPermission();
  const { selectedAssets, setSelectedAssets } = usePhotoAssessmentSession();
  const [offlineError, setOfflineError] = useState(false);

  if (permission.isChecking) {
    return (
      <View style={styles.centered} testID="photo-select-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (permission.state === 'denied') {
    return <PermissionDeniedView />;
  }

  const canSubmit = isValidSelectionCount(selectedAssets.length);

  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
    });
    if (!result.canceled) {
      setSelectedAssets(result.assets);
      setOfflineError(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const online = await isOnline();
    if (!online) {
      setOfflineError(true);
      return;
    }
    setOfflineError(false);
    router.push('/photo-assessment/processing');
  };

  return (
    <View style={styles.container}>
      {permission.state === 'limited' && (
        <LimitedAccessBanner onSelectMore={permission.requestAgain} />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>写真を選ぶ</Text>
        <Text style={styles.body}>1〜{MAX_PHOTOS}枚の写真を選んでください。</Text>

        <Pressable testID="photo-select-pick-button" style={styles.pickButton} onPress={handlePick}>
          <Text style={styles.pickButtonText}>ライブラリから選ぶ</Text>
        </Pressable>

        <Text testID="photo-select-count" style={styles.count}>
          {selectedAssets.length}/{MAX_PHOTOS}枚選択中
        </Text>

        {selectedAssets.length > 0 && (
          <View style={styles.thumbnailGrid}>
            {selectedAssets.map((asset) => (
              <Image key={asset.assetId ?? asset.uri} source={{ uri: asset.uri }} style={styles.thumbnail} />
            ))}
          </View>
        )}

        {!canSubmit && (
          <Text testID="photo-select-validation-message" style={styles.validationMessage}>
            1〜{MAX_PHOTOS}枚を選択してください
          </Text>
        )}

        {offlineError && (
          <Text testID="photo-select-offline-message" style={styles.validationMessage}>
            オフラインです。接続を確認してから再度お試しください。
          </Text>
        )}
      </ScrollView>

      <Pressable
        testID="photo-select-submit"
        disabled={!canSubmit}
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>送信する</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    color: '#555555',
  },
  pickButton: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
    color: '#555555',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  validationMessage: {
    fontSize: 14,
    color: '#B00020',
  },
  submitButton: {
    backgroundColor: '#111111',
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 32,
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

import * as ImagePicker from 'expo-image-picker';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type PhotoAssessmentSessionValue = {
  selectedAssets: ImagePicker.ImagePickerAsset[];
  setSelectedAssets: (assets: ImagePicker.ImagePickerAsset[]) => void;
};

const PhotoAssessmentSessionContext = createContext<PhotoAssessmentSessionValue | null>(null);

export function PhotoAssessmentSessionProvider({ children }: PropsWithChildren) {
  const [selectedAssets, setSelectedAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const value = useMemo(() => ({ selectedAssets, setSelectedAssets }), [selectedAssets]);

  return (
    <PhotoAssessmentSessionContext.Provider value={value}>
      {children}
    </PhotoAssessmentSessionContext.Provider>
  );
}

export function usePhotoAssessmentSession(): PhotoAssessmentSessionValue {
  const ctx = useContext(PhotoAssessmentSessionContext);
  if (!ctx) {
    throw new Error('usePhotoAssessmentSession must be used within PhotoAssessmentSessionProvider');
  }
  return ctx;
}

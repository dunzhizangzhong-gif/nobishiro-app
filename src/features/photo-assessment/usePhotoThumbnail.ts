import { useEffect, useState } from 'react';

import { resolvePhotoUri } from '../../lib/media/resolvePhotoUri';

// undefined = 解決中, null = 表示不可(プレースホルダ), string = 表示可能なURI
export function usePhotoThumbnail(photoRef: string | undefined): string | null | undefined {
  const [uri, setUri] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!photoRef) {
      setUri(null);
      return;
    }
    let active = true;
    setUri(undefined);
    resolvePhotoUri(photoRef).then((resolved) => {
      if (active) setUri(resolved);
    });
    return () => {
      active = false;
    };
  }, [photoRef]);

  return uri;
}

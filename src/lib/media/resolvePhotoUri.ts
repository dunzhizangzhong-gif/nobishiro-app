import { Asset } from 'expo-media-library';

// 「限定」権限時はassetIdが取得できずuri(pickerキャッシュパス)がphotoRefsに
// 保存される(decision-log.md DL-013)。すでに描画可能なuri/パスならそのまま使う。
function looksLikeRenderableUri(ref: string): boolean {
  return /^(file|content|ph|assets-library):\/\//.test(ref) || ref.startsWith('/');
}

// photoRefs(assetIdまたはuriフォールバック)から表示可能なURIを解決する。
// 解決できない場合はnull(呼び出し側でプレースホルダ表示)。
export async function resolvePhotoUri(photoRef: string): Promise<string | null> {
  if (looksLikeRenderableUri(photoRef)) {
    return photoRef;
  }
  try {
    const uri = await new Asset(photoRef).getUri();
    return uri || null;
  } catch {
    return null;
  }
}

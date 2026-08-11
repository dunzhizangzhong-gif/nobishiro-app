import type { ReferenceImage } from '../../types/domain';

// spec.md 7章ReferenceImage・AC-005の同梱ライブラリ。
// 改善カテゴリ6種それぞれに1枚以上の言語ガイドを用意する。
// 実イラスト素材の制作は別トラック(decision-log.md DL-003)のため、
// v1.0実装時点ではcaption(言語ガイド)のみを確定データとして持ち、
// 画面側でcategoryに応じたプレースホルダー図形を描画する。
export const REFERENCE_IMAGES: ReferenceImage[] = [
  {
    id: 'light-1',
    category: 'light',
    caption: '明るい窓際で、斜め45度から光を受けると陰影が柔らかくなります。逆光は避けましょう。',
  },
  {
    id: 'composition-1',
    category: 'composition',
    caption: '被写体との距離を少し離し、上半身が収まる構図にすると自然な印象になります。',
  },
  {
    id: 'expression-1',
    category: 'expression',
    caption: '目線をカメラよりやや上に置き、口角を軽く上げると柔らかい表情になります。',
  },
  {
    id: 'outfit-1',
    category: 'outfit',
    caption: '無地または落ち着いた色の服を選ぶと、顔まわりが引き立ちます。',
  },
  {
    id: 'background-1',
    category: 'background',
    caption: '背景がすっきりした場所を選ぶと、被写体が際立ちます。',
  },
  {
    id: 'other-1',
    category: 'other',
    caption: '全体のバランスを整えると、より好印象な写真になります。',
  },
];

// AC-005 失敗時: カテゴリに対応するイラストが未定義の場合はotherへフォールバックする(空画面を出さない)
export function getReferenceImagesForCategory(category: string): ReferenceImage[] {
  const matches = REFERENCE_IMAGES.filter((image) => image.category === category);
  if (matches.length > 0) {
    return matches;
  }
  return REFERENCE_IMAGES.filter((image) => image.category === 'other');
}

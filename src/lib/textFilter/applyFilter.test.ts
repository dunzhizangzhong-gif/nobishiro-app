import {
  FALLBACK_ADVICE_MESSAGE,
  FALLBACK_REASON_MESSAGE,
  containsForbiddenPattern,
  sanitizePhotoAssessmentResult,
} from './applyFilter';
import type { PhotoAssessmentApiResult } from '../api/photoAssessmentClient';

describe('containsForbiddenPattern', () => {
  it('does not flag ordinary photography advice', () => {
    expect(containsForbiddenPattern('窓際の自然光で撮ると表情が明るく見えます')).toBe(false);
  });

  describe('AC-003: 出典誤認防止(他社名+データ/統計)', () => {
    it.each([
      'Pairsのデータによると、明るい写真が好まれます',
      'Tinderの統計では笑顔の写真が有利です',
      'タップルの調査結果でも同じ傾向が見られます',
    ])('flags "%s"', (text) => {
      expect(containsForbiddenPattern(text)).toBe(true);
    });

    it('does not flag a generic reference to general trends without a competitor name', () => {
      expect(containsForbiddenPattern('一般的な傾向として、明るい写真が好まれます')).toBe(false);
    });
  });

  describe('AC-004: 体型・体重への言及/変化を促す表現(spec.md記載の例)', () => {
    it.each(['体を鍛えるとより魅力的です', '痩せると印象が変わります', 'ダイエットすることをおすすめします'])(
      'flags "%s"',
      (text) => {
        expect(containsForbiddenPattern(text)).toBe(true);
      }
    );

    it.each(['体型が気になる方は', '体重を意識してみましょう', 'ぽっちゃりした印象です'])(
      'flags direct body references "%s"',
      (text) => {
        expect(containsForbiddenPattern(text)).toBe(true);
      }
    );
  });
});

describe('sanitizePhotoAssessmentResult (AC-003/AC-004の置換ルール)', () => {
  const baseResult: PhotoAssessmentApiResult = {
    score: 4,
    reasons: ['自然光が良い', '背景がすっきりしている'],
    improvements: [{ category: 'light', advice: '窓際で撮ると良い' }],
  };

  it('leaves clean results unchanged', () => {
    expect(sanitizePhotoAssessmentResult(baseResult)).toEqual(baseResult);
  });

  it('removes only the reason containing a forbidden pattern, keeping other valid reasons', () => {
    const result: PhotoAssessmentApiResult = {
      ...baseResult,
      reasons: ['自然光が良い', 'Pairsのデータによると好印象です'],
    };
    expect(sanitizePhotoAssessmentResult(result).reasons).toEqual(['自然光が良い']);
  });

  it('replaces reasons with a fallback message when every reason is filtered out', () => {
    const result: PhotoAssessmentApiResult = {
      ...baseResult,
      reasons: ['Tinderの統計で人気です', '痩せて見える構図です'],
    };
    expect(sanitizePhotoAssessmentResult(result).reasons).toEqual([FALLBACK_REASON_MESSAGE]);
  });

  it('replaces an improvement advice containing a forbidden pattern with the fallback message (spec.md記載の文言)', () => {
    const result: PhotoAssessmentApiResult = {
      ...baseResult,
      improvements: [{ category: 'light', advice: '体を鍛えるとより良く見えます' }],
    };
    expect(sanitizePhotoAssessmentResult(result).improvements).toEqual([
      { category: 'light', advice: FALLBACK_ADVICE_MESSAGE },
    ]);
  });

  it('AC-004補足: モック応答が体型変化を促す内容でも、カテゴリに関わらず画面に表示されない', () => {
    // 4観点(構図・角度/服装・スタイリング/光・背景/表情)のいずれのcategoryタグが付いていても、
    // advice本文が体型変化を促す内容ならフィルタされることを確認する(プロンプト制約の外側の防御層)。
    const mockResponse: PhotoAssessmentApiResult = {
      score: 3,
      reasons: ['自然光が良い'],
      improvements: [
        { category: 'outfit', advice: 'ダイエットしてから撮ると良いでしょう' },
        { category: 'composition', advice: '距離を離して撮ると良いでしょう' },
      ],
    };
    const sanitized = sanitizePhotoAssessmentResult(mockResponse);
    expect(sanitized.improvements[0].advice).toBe(FALLBACK_ADVICE_MESSAGE);
    expect(sanitized.improvements[1].advice).toBe('距離を離して撮ると良いでしょう');
  });

  it('keeps the score untouched', () => {
    expect(sanitizePhotoAssessmentResult(baseResult).score).toBe(4);
  });
});

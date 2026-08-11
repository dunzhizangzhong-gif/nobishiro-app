export type Profile = {
  ageConfirmedAt: string | null;
  onboardingCompletedAt: string | null;
};

export type Quota = {
  photoAssessmentsUsed: number;
  replyGenerationsUsed: number;
};

export type ImprovementCategory =
  | 'light'
  | 'composition'
  | 'expression'
  | 'outfit'
  | 'background'
  | 'other';

export type Improvement = {
  category: ImprovementCategory;
  advice: string;
};

export type PhotoAssessmentResult = {
  score: number;
  reasons: string[];
  improvements: Improvement[];
};

export type PhotoAssessment = {
  id: string;
  createdAt: string;
  photoRefs: string[];
  recommendedIndex: number;
  results: PhotoAssessmentResult[];
  // モデレーション(AC-022)・人物検出(AC-024)によりバッチから除外された枚数。
  // 除外がない場合は未設定(0件表示との違いをつけない)。実際の集計値はT16でプロキシ
  // レスポンスから設定する。spec.md 8章S-5「除外があったことを示す表示」に対応。
  excludedCount?: number;
};

export type ReplyTone = 'polite' | 'casual' | 'humorous' | null;

export type ReplySuggestion = {
  text: string;
  aim: string;
};

export type ReplySession = {
  id: string;
  createdAt: string;
  inputType: 'screenshot' | 'text';
  inputText: string;
  tone: ReplyTone;
  suggestions: ReplySuggestion[];
};

export type ReferenceImage = {
  id: string;
  category: ImprovementCategory;
  // 実イラスト素材の制作は別トラック(decision-log.md DL-003)。v1.0実装時点では
  // 画像アセットの代わりにcategoryに応じたプレースホルダー図形を画面側で描画する。
  caption: string;
};

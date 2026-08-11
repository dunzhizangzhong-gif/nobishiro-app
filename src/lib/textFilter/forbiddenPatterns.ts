// spec.md AC-003/AC-004 の禁止パターン初期案。
// AC-004補足のとおりリスト自体がレビュー対象(仕様上「別紙で定義」とされているが未提供のため、
// ここに一次案として実装。人間によるレビュー・追補を前提とする)。

// AC-003: 他社名+データ/統計を想起させる表現(出典誤認防止)。
// spec.md 2章の対象アプリ名(Pairs/with/Omiai/タップル/Tinder)を対象とする。
export const SOURCE_MISATTRIBUTION_PATTERNS: RegExp[] = [
  /(Pairs|ペアーズ|with|ウィズ|Omiai|オミアイ|タップル|Tinder|ティンダー)[^。！？\n]{0,15}(データ|統計|調査結果?|ランキング)/i,
];

// AC-004: 容姿(体型・体重)への直接言及、および体型・体重そのものを変える行為を示唆する表現。
// vision LLM提供元のUsage Policy対応(decision-log.md DL-005)。
export const BODY_CHANGE_PATTERNS: RegExp[] = [
  /体型/,
  /体重/,
  /太っ/,
  /痩せ/,
  /ぽっちゃり/,
  /ダイエット/,
  /減量/,
  /増量/,
  /筋トレ/,
  /体を鍛え/,
  /運動(して|しましょう|をして)/,
  /トレーニング(して|しましょう)/,
  /ジムに通/,
  /カロリー/,
];

export const FORBIDDEN_PATTERNS: RegExp[] = [...SOURCE_MISATTRIBUTION_PATTERNS, ...BODY_CHANGE_PATTERNS];

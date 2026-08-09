# このリポジトリの開発ルール(AI向け・常時適用)

このリポジトリは「モバイルアプリ開発 業務フロー v5」で運用する。
各工程は `.claude/commands/` のコマンドで実行する。詳細な手順書は
`モバイルアプリ開発_業務フロー_v5.md` を参照。

## 技術スタック(固定・変更禁止)
- React Native + Expo(マネージドワークフロー)
- ローカル保存: AsyncStorage(サーバー不要のMVPを基本とする)
- ビルド・提出: EAS Build / EAS Submit
- E2Eテスト: Maestro、unitテスト: Jest
- クラッシュ計測: Sentry

## 絶対禁止
- spec.md v1.0にない機能の追加(必要ならspecs/decision-log.mdに記録し人間の承認を得る)
- 依存ライブラリの無断追加
- APIキー・シークレットのコード直書き(必ず環境変数・EAS Secrets)
- リモートから動的にコードを取得して実行する仕組み(App Store審査2.5.2違反)
- WebViewで既存Webをラップしただけの画面
- Mobbinや競合アプリの名称・アイコン・文言・素材の流用

## 進め方の原則
- 実装は必ず「計画提示→人間の承認→タスク単位で実行」。一気に全部書かない
- 各タスク完了時に、対応AC・実行したテスト・残るリスクを短く報告する
- 各AC(specs/spec.mdの9番)には対応する自動テストを書く。テストのないACを「完了」としない
- 仕様の曖昧さに気づいたら勝手に解釈せず、decision-log.mdに論点を書いて質問する
- レビュー・監査は自分(同一セッション)で行わない。人間が別セッションで実行する

## 成果物の置き場所
- specs/research.md, spec.md, ui-direction.md, decision-log.md, release-checklist.md
- spec.mdはバージョン管理し、v1.0確定後の変更は必ずdecision-log.md経由

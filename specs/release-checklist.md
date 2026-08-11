# リリースチェックリスト(STEP 6)— アプリごとに複製して使う

## T17. 実機確認チェックリスト(モバイルアプリ開発_業務フロー_v5.md STEP 5 + Sandbox課金・DoD確認)

**注記(番号の使い分け)**: `モバイルアプリ開発_業務フロー_v5.md`では「6-0」は
**STEP 6-0(mainへのpushで`.eas/workflows/build-and-submit.yml`が自動ビルド→TestFlight提出まで行う仕組み)**
を指す固有の名称であり、このセクションとは別物。ここではdecision-log.md DL-003の実装タスク表にある
「T17: 実機スモーク・Sandbox課金確認・DoD確認」の名称を使う。位置づけとしてはSTEP 5
(実機スモーク・人間ゲート3)に、このプロジェクト固有でSandbox課金確認とDoD確認を束ねたもの。
STEP 5の公式な最小チェックは「新規インストール→初回価値到達→再起動→オフライン→権限拒否→
ダークモード・文字サイズ変更」の6項目(下記フェーズ3aとして再掲)。以下はそれを含む、より広い
T17の作業一覧。6-1/6-2/6-3の既存項目と重複しないよう、**T17でしか確認できないもの**(実機・実プロキシ・
外部ダッシュボードが要る作業)に絞って整理してある。6-1/6-2側の項目は参照のみで再掲しない。

### 0-1. 積み残し事項の一覧(実施順序の目安つき)

**フェーズ0: ビルド・配布の土台(T17着手前に対応が必要。いずれも人間が実機で行う操作で、
AI側ではコマンド実行しない)**
- [ ] **`eas.json`の作成**。`モバイルアプリ開発_業務フロー_v5.md`の「初回セットアップ」手順3
   が、このアプリではまだ実施されていない。以下を人間が実行する:
   1. `npm i -g eas-cli`
   2. `eas login`
   3. `eas build:configure`(`eas.json`が生成される)
   4. Apple Developer Program加入(未加入の場合)
   5. App Store Connect APIキーを作成しEASに登録(STEP 6-0の自動submitが非対話で回るために必要)
- [ ] `eas.json`に、STEP 6-0が使う`production`プロファイルとは別に、**実機/シミュレータへ直接
   インストールしてMaestroやSTEP 5の手動確認に使う`development`(または`preview`)プロファイル**を
   用意する。`production`ビルドは`.eas/workflows/build-and-submit.yml`がmainへのpushで自動的に
   トリガーする専用の流れなので、T17のイテレーション用に手元で何度も`eas build`する場合は
   development/previewプロファイルを使い、本番提出用ビルドを不要に消費しない
- [ ] 依存する外部サービスのAPIキー・DSN発行(RevenueCat/PostHog/Sentry)。手順は本セクション0-3参照。
   発行した値は`.env`ではなく**EAS Secrets**(`eas secret:create`)に登録し、実機ビルドへ注入する
   (`.env`はローカル`expo start`用。EAS Buildでは読み込まれない)

**フェーズ1: プロキシ(最優先ブロッカー)**
1. **`nobishiro-proxy`(別リポジトリ)のデプロイ**。spec.md 6章の通りCloudflare Workers等へ
   ステートレスにデプロイし、`EXPO_PUBLIC_PROXY_BASE_URL`をEAS Secretsに設定する。
   **これが無い限り、AC-001/006(成功パス)・AC-002(実測)・AC-014(プロキシ側レビュー)・
   AC-022/023/024(モデレーション・レート制限・人物検出)は一切実機確認できない**
   (STEP4実装ではT6/T10/T16いずれも自前のJestモックのみで検証しており、実プロキシ・実vision APIとの
   疎通は未検証)
2. AC-014手動確認: `nobishiro-proxy`側のコードレビューで、ログ・ストレージへの写真/会話本文の
   永続化コードが無いことを確認する(対象は別リポジトリ)

**フェーズ2: Maestro E2E(手順は0-2参照)**
3. 既存14本のMaestro flowをシミュレータ or 実機で実行する
4. **解消済み**: AC-018(フォトライブラリ権限フロー)のE2Eギャップ(spec.mdが要求する「拒否時の
   説明画面表示と『設定を開く』ボタンの存在」「未リクエスト時のOSダイアログ許可→S-3到達」)は、
   `photo-permission-denied.yaml`・`photo-permission-first-request.yaml`の2本を追加して埋めた
   (2026-08-11)。ただしOS標準ダイアログのボタン文言は端末言語設定に依存するため、実機/シミュレータで
   実際に動作するかは本セッションでは未検証(実行して問題があれば`tapOn`のtext部分を調整する)

**フェーズ3: フォトライブラリ権限(AC-018/019)実機確認**
5. 未リクエスト→OS標準ダイアログで「すべての写真へのアクセスを許可」→S-3到達
6. 「選択した写真のみ許可(限定)」選択時の表示、および「他の写真も追加で選べます」導線
7. 「許可しない」選択時の説明画面表示、「設定を開く」タップで実際にiOS設定アプリの本アプリ設定
   ページが開くこと(AC-018の唯一の手動専用確認項目)
8. DL-013/DL-014の実機確認: 「限定」権限時、`assetId`が`null`になり`uri`にフォールバックする
   ケースで、判定結果画面(S-5)・履歴(S-9)のサムネイルが実際にどう見えるか(uriの有効期限切れ等で
   表示できないケースが無いか)

**フェーズ3a: STEP 5公式の実機スモーク6項目**(モバイルアプリ開発_業務フロー_v5.md記載どおり。
権限拒否はフェーズ3と重複するため参照のみ)
9. 新規インストール(`clearState`相当。オンボーディング〜初回起動に不具合がないか)
10. 初回価値到達(実際に写真判定または返信支援を1回最後まで完了できるか。フェーズ4が前提)
11. **再起動**: アプリを一度完全終了→再起動し、無料枠カウント・履歴・年齢確認状態等の
    AsyncStorage保存内容が正しく保持されていること(STEP4実装ではJestのモックAsyncStorageでのみ
    検証しており、実際のOS再起動を跨いだ永続化は未検証)
12. **オフライン**: 機内モード等でネットワーク遮断状態にし、AC-016(オフライン時のAI機能エラー、
    T6/T10で実装済み)の表示が実機でも正しく出ること
13. 権限拒否 → フェーズ3(項目7)を参照
14. **ダークモード・文字サイズ変更**: iOS設定でダークモード・Dynamic Type(文字サイズ)を変更し、
    表示崩れがないこと。ui-direction.md(DL-011)がiOSセマンティックカラー+Dynamic Type採用を
    前提にしているが、実機での表示崩れ有無は未検証

**フェーズ4: AI機能フロー(プロキシ稼働後)**
15. 写真判定(S-3〜S-5)成功パスの通し確認、AC-002の応答時間実測値(30秒目標・60秒タイムアウト)を記録
16. 返信支援(S-7〜S-8)成功パスの通し確認(テキスト入力・スクショ入力の両方)
17. AC-022実機確認: モデレーションNGの画像で(a)写真判定バッチの一部除外 (b)全滅 (c)返信支援
    スクショの単体拒否、それぞれの表示・無料枠非消費を確認
18. AC-023実機確認: レート制限(1時間20回/24時間100回)超過時の専用エラー表示。閾値到達には
    プロキシ側のテスト用閾値引き下げ等の工夫が要る
19. AC-024実機確認: 人物が写っていない画像での(a)一部除外 (b)全滅の表示・無料枠非消費を確認
20. **DL-015の再確認**: 全滅時に理由(モデレーション/人物検出)が混在するケースで
    「モデレーション優先表示」とした判断が、実際のプロキシ・vision AIの応答傾向と照らして
    妥当かどうかを、実データが取れた段階で見直す(問題なければ追加対応不要)

**フェーズ5: 課金・計測・監視**(手順は0-3参照。実施自体は6-1に項目あり、ここでは順序のみ示す)
21. RevenueCat: Sandbox購入・リストアの実機確認(6-1既存項目)
22. PostHog: 実機操作後、ダッシュボードで9イベントの着信・プロパティ内容を確認
23. Sentry: テスト用例外がダッシュボードに記録されることを確認(AC-017)

**フェーズ6: DoD総仕上げ**
24. spec.md 10章DoD項目3: フローA(写真判定→参考イメージ)・フローB(返信支援)・
    フローC(購入→リストア)を実機で通しで実行し、クラッシュ0件・応答時間実測値を記録
25. 6-1/6-2の残タスク(プライバシーポリシーURL確定、ライセンス一覧生成、禁止語リストの人間レビュー、
    参考イメージの実素材差し替え等)は本フェーズと並行して進めてよい(本項では再掲しない。6-1/6-2参照)

### 0-2. Maestro E2E実機実行手順

**インストール**
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
# シェル再起動、または以下をPATHに追加
export PATH="$PATH":"$HOME/.maestro/bin"
maestro --version
```
iOS実行にはXcode Command Line Tools(`xcode-select --install`)が必要。
`eas build --local`(下記)を使う場合はCLIツールだけでなくXcode.app本体のインストールが必要
(App Storeから)。クラウドビルド(`--local`無し)ならXcode不要でシミュレータ/実機向けビルドを
取得できるが、シミュレータへのインストール自体(`xcrun simctl install`)にはXcode Command Line Toolsが要る。

**テスト対象ビルドの用意**(前提: フェーズ0で`eas.json`作成・development/previewプロファイル用意済み。
`production`プロファイルはSTEP 6-0がmainへのpushで自動的に使うため、ここでは使わない)
```bash
# シミュレータ向け(署名不要・最速でMaestroを試せる。developmentプロファイルにsimulator: trueを設定)
eas build --platform ios --profile development --local  # または --profile preview
# ダウンロードした.app/.tar.gzをシミュレータへ
xcrun simctl install booted <path-to-App.app>

# 実機向け(T17の「実機スモーク」はこちらが本命。Ad Hoc/Internal Distribution + 実機のUDID登録が必要)
eas build --platform ios --profile preview
# ビルド完了後、eas build:run または TestFlight/Ad Hoc配布経由で実機にインストール
```

**フロー実行**
```bash
# 個別に実行
maestro test .maestro/onboarding-age-gate-accept.yaml

# .maestro/配下を一括実行(READMEは対象外・14ファイル)
maestro test .maestro/

# 失敗時、対話的にUI階層を確認しながらデバッグ
maestro studio
```
全flowが`launchApp: {clearState: true}`から始まるため、実行順序に依存せず独立して実行できる。
`reply-assist-text-flow.yaml`と`paywall-unavailable.yaml`は、ファイル冒頭のコメントの通り
プロキシ・RevenueCat未稼働を前提にした「到達確認まで」のflowなので、フェーズ1・フェーズ5完了後は
別途、成功パスまで到達することを手動で追加確認する(フロー自体の書き換えは必須ではない)。

### 0-3. RevenueCat / PostHog / Sentry: キー発行〜実機確認の手順

**RevenueCat(AC-010)**
1. RevenueCatダッシュボードでプロジェクト作成
2. entitlement識別子 `"pro"` を作成(コード側はこの識別子を前提に実装済み。名称を変えると動かない)
3. App Store Connectでサブスクリプション商品を作成(価格はDL-002の仮月額980円を踏まえ最終確定)し、
   RevenueCatのデフォルトofferingに紐付け
4. RevenueCatでiOS用APIキーを発行し、EAS Secretsに`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`として登録
   (`eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value <key>`)
5. App Store ConnectでSandboxテスターアカウントを作成
6. 実機ビルドをSandboxアカウントでインストールし、ペイウォール→購入→復元を実施、結果を6-3に記録
   (無料枠超過→ペイウォール到達の経路も合わせて確認)

**PostHog(AC-015)**
1. PostHogプロジェクトを作成し、Project API Key・ホストURL(リージョン)を取得
2. EAS Secretsに`EXPO_PUBLIC_POSTHOG_API_KEY`・`EXPO_PUBLIC_POSTHOG_HOST`を登録
3. 実機ビルドで9操作(オンボーディング完了・写真送信・判定表示・参考イメージ閲覧・返信案表示・
   返信案コピー・ペイウォール表示・購入完了・履歴閲覧)を一通り実施
4. PostHogダッシュボード(Activity/Live Events)で9イベント名・プロパティが仕様通りで、
   写真・会話内容を含まないことを確認

**Sentry(AC-017)**

**訂正(2026-08-11、実際のEAS Buildで判明)**: 当初「`app.json`のorganization/project未設定は警告のみで
ビルド自体は成功する」と記載していたが誤りだった。`npx expo export`(バンドル生成のみ)では警告に留まるが、
**実際のEAS Build(Xcode/fastlaneのネイティブビルドフェーズ)では、`@sentry/react-native`の設定プラグインが
組み込む`sentry-cli`のソースマップ自動アップロードが`An organization ID or slug is required`でハード失敗し、
ビルド自体が失敗する**。DSNが未発行の間はこのアップロード自体が不要なため、`eas.json`の各build
プロファイルに`SENTRY_DISABLE_AUTO_UPLOAD: "true"`を設定してアップロードをスキップする対応を入れた
(sentry-cliのエラーメッセージ自身が案内する回避策)。Sentryプロジェクトを作成しorganization/DSNを
設定したら、この環境変数は削除し、正しいソースマップアップロードを有効化すること。

1. Sentryでプロジェクトを作成(Platform: React Native)、DSNを取得
2. EAS Secretsに`EXPO_PUBLIC_SENTRY_DSN`を登録
3. `app.json`の`@sentry/react-native`プラグイン設定にorganization/projectを追記する(ビルド時の
   「Missing config for organization, project」警告の解消に加え、ソースマップの正しいアップロードにも必要)
4. `eas.json`の各build プロファイルから`SENTRY_DISABLE_AUTO_UPLOAD: "true"`を削除する
   (3を先に済ませてから削除しないと、再びビルド失敗に戻る)
5. 実機ビルドでテスト用の例外を1件発生させる(恒久的なデバッグボタンはコードに残さない方針のため、
   ローカルで一時的に任意の画面へ`throw`または`Sentry.captureException(new Error('test'))`相当を
   仕込んで実行→確認後にrevertする、が簡便)
6. Sentryダッシュボードにイベントが1件記録されることを確認(AC-017の手動確認項目)

## 6-1. 事前準備(仕様書確定後すぐ着手可)
- [ ] プライバシーポリシーの作成・掲載先URL確定(ストア側とアプリ内UIの両方)。STEP4実装(T14)では`EXPO_PUBLIC_PRIVACY_POLICY_URL`・`EXPO_PUBLIC_TERMS_URL`が未設定のため、設定画面(S-11)のプライバシーポリシー・利用規約の行は「準備中」表示で無効化されている。URL確定後、上記環境変数に設定する
- [ ] 使用ライブラリのライセンス一覧の生成(spec.md 10章DoD項目7)。STEP4実装(T14)では`app/settings/licenses.tsx`に画面自体は用意したが、実際のライセンス一覧生成ツール(license-checker等)は未導入のプレースホルダー表示。ツール導入は新規依存ライブラリの追加になるため、着手前に人間の承認が必要
- [ ] 問い合わせ用メールアドレスの確定
- [ ] アプリアイコン・スクリーンショット素材(独自デザイン。テンプレート感に注意)
- [ ] 参考イメージ(S-6)のイラストをプレースホルダーから実素材に差し替える。STEP4実装(T9)ではイラスト制作が別トラック(decision-log.md DL-003)のため、spec.md 7章`ReferenceImage.asset`の代わりにcategoryごとの単色プレースホルダー図形(コード描画・画像ファイルなし)で実装している。実素材を用意した際は、10章DoD項目7(同梱イラストの権利確認。自作または商用利用可ライセンス)もあわせて確認する
- [ ] Bundle ID / パッケージ名の確定
- [ ] ローカライズ範囲・提出対象ストア地域の確定(v1.0はUIを日本語のみとし、App Store提出対象地域は日本ストアのみとする。将来の多言語・他地域対応はv1.0スコープ外)
- [ ] RevenueCatダッシュボード・App Store Connect側の課金設定(STEP4実装(T12)時点ではAPIキー未発行のため、コード側は`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`未設定時にPurchases初期化をスキップし、ペイウォールは「現在ご利用いただけません」を表示する設計で進めた)。以下を実施しAPIキーを`.env`/EAS Secretsに設定する:
  - [ ] entitlement識別子`"pro"`の作成(コード側はこの識別子を前提に実装済み)
  - [ ] App Store Connectでサブスクリプション商品を作成し、RevenueCatのoffering(デフォルトoffering)に紐付け。価格はDL-002(仮月額980円)を踏まえて最終確定する
  - [ ] iOS用APIキーの発行・`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`への設定
  - [ ] App Store Sandboxでの購入・リストア実機確認(AC-010手動確認項目、結果を6-3に記録)
- [ ] PostHogプロジェクトの作成・APIキー発行(STEP4実装(T15)時点ではAPIキー未発行のため、コード側は
  `EXPO_PUBLIC_POSTHOG_API_KEY`未設定時に計測初期化をスキップし、`trackEvent`は無音でno-opとなる設計で
  進めた)。発行後`EXPO_PUBLIC_POSTHOG_API_KEY`・`EXPO_PUBLIC_POSTHOG_HOST`を`.env`/EAS Secretsに設定する
- [ ] Sentryプロジェクトの作成・DSN発行(STEP4実装(T15)時点ではDSN未発行のため、コード側は
  `EXPO_PUBLIC_SENTRY_DSN`未設定時に初期化をスキップする設計で進めた)。発行後`EXPO_PUBLIC_SENTRY_DSN`を
  `.env`/EAS Secretsに設定し、AC-017の手動確認(テスト用捕捉例外がダッシュボードに記録されること)を実施する。
  あわせて`app.json`の`@sentry/react-native`プラグイン設定にorganization/projectを追加し、
  `eas.json`の各buildプロファイルから`SENTRY_DISABLE_AUTO_UPLOAD: "true"`を削除する。
  **この2つは組で行うこと**: 2026-08-11の実EAS Buildで、organization/project未設定のまま
  `SENTRY_DISABLE_AUTO_UPLOAD`だけを外すと、ソースマップ自動アップロード(`sentry-cli`)が
  `An organization ID or slug is required`でハード失敗しビルド自体が失敗することを確認済み
  (詳細はT17セクション0-3参照)

## 6-2. オリジナリティ・コンプライアンス
- [ ] AC-003/AC-004の禁止パターンリスト(src/lib/textFilter/forbiddenPatterns.ts)の人間レビュー。STEP4実装時点では一次案(spec.md AC-004補足で「別紙で定義」とされていたが未提供だったため実装側で作成)。他社名の網羅性・体型/体重関連語の過不足を確認する
- [ ] STEP 4.5監査レポートの再確認(未審査コード実行なし・WebViewラップなし)
- [ ] npm audit既知脆弱性の再確認(image-size DoS/uuid buffer bounds、ビルド時依存のみ・上流未修正。decision-log.md DL-012参照。修正版が出ていれば依存関係を更新)
- [ ] 既存人気アプリと名称・アイコン・主要画面が見分けがつくレベルで異なる
- [ ] 収集データとPrivacy Nutrition Label / データセーフティ申告の一致
- [ ] 課金・サブスクの価格・自動更新条件の表示が規定通り
- [ ] ログイン機能がある場合、審査用デモアカウントまたは完全なデモモード

## 6-3. 提出直前
- [ ] TestFlight / 内部テストでの確認(6-0で自動配布済みのビルドを使う)
- [ ] ストア掲載文(タイトル・説明文・カテゴリ)。既存アプリの丸写し禁止
- [ ] 年齢制限・データ収集の申告項目
- [ ] 審査ノートに非自明な動作(オフライン専用等)を記載

## 6-4. 提出後
- [ ] 審査フィードバック対応(却下時は指摘箇所だけ修正依頼。推測で直さない)
- [ ] 却下理由のガイドライン番号を確認してから対応

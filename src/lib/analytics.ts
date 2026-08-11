import PostHog from 'posthog-react-native';

let client: PostHog | null = null;

// AC-017(Sentry)と同じ方針: APIキー未設定時は初期化をスキップする。
// PostHogダッシュボード側の設定(プロジェクト作成・APIキー発行)は別途人間が実施する
// (specs/release-checklist.md参照)。
export function initAnalytics(): void {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  if (!apiKey) {
    return;
  }
  if (client) {
    return;
  }
  client = new PostHog(apiKey, { host: process.env.EXPO_PUBLIC_POSTHOG_HOST });
}

export function isAnalyticsConfigured(): boolean {
  return client !== null;
}

// AC-015: 記録対象の9イベント。写真・会話の内容はプロパティに含めない
// (durationSeconds/inputTypeのみを持つ2件を除き、いずれもプロパティなしの単純な発生記録)
export type AnalyticsEvent =
  | { name: 'onboarding_completed' }
  | { name: 'photo_submitted' }
  | { name: 'assessment_completed'; properties: { durationSeconds: number } }
  | { name: 'reference_viewed' }
  | { name: 'reply_generated'; properties: { inputType: 'text' | 'screenshot' } }
  | { name: 'reply_copied' }
  | { name: 'paywall_viewed' }
  | { name: 'purchase_completed' }
  | { name: 'history_viewed' };

// AC-015 失敗時: PostHog送信失敗はアプリの機能動作に影響させない(fire-and-forget)。
// 送信される識別子はPostHogが自動生成する匿名ID(端末生成のランダムID)のみで、
// IDFA等の広告識別子は一切扱わない(呼び出し元もこの関数もそれらを取得・送信しない)。
export function trackEvent(event: AnalyticsEvent): void {
  if (!client) {
    return;
  }
  try {
    if ('properties' in event) {
      client.capture(event.name, event.properties);
    } else {
      client.capture(event.name);
    }
  } catch {
    // fire-and-forget: 計測失敗はアプリの機能動作に影響させない
  }
}

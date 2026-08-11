import * as Sentry from '@sentry/react-native';

let configured = false;

// AC-017 失敗時: DSN未設定のローカル開発ビルドではSentry初期化をスキップし、クラッシュさせない。
// DSNはコードに直書きせず、環境変数(EAS Secrets経由)からのみ読み込む。
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  if (configured) {
    return;
  }
  Sentry.init({ dsn });
  configured = true;
}

export function isSentryConfigured(): boolean {
  return configured;
}

// 端末ローカルの識別子生成(暗号強度は不要。履歴レコードのidにのみ使用)
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

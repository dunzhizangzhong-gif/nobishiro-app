export const MIN_TEXT_LENGTH = 1;
export const MAX_TEXT_LENGTH = 2000;

export function isValidReplyText(text: string): boolean {
  return text.length >= MIN_TEXT_LENGTH && text.length <= MAX_TEXT_LENGTH;
}

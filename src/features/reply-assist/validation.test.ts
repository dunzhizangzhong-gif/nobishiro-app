import { MAX_TEXT_LENGTH, isValidReplyText } from './validation';

describe('isValidReplyText (AC-007 失敗時: 1〜2000文字)', () => {
  it('rejects an empty string', () => {
    expect(isValidReplyText('')).toBe(false);
  });

  it('accepts a single character', () => {
    expect(isValidReplyText('あ')).toBe(true);
  });

  it(`accepts exactly ${MAX_TEXT_LENGTH} characters`, () => {
    expect(isValidReplyText('あ'.repeat(MAX_TEXT_LENGTH))).toBe(true);
  });

  it(`rejects ${MAX_TEXT_LENGTH + 1} characters`, () => {
    expect(isValidReplyText('あ'.repeat(MAX_TEXT_LENGTH + 1))).toBe(false);
  });
});

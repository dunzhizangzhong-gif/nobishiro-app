import { MAX_PHOTOS, MIN_PHOTOS, isValidSelectionCount } from './validation';

describe('isValidSelectionCount (AC-001 失敗時(b) 1〜5枚の境界値)', () => {
  it('rejects 0 photos', () => {
    expect(isValidSelectionCount(0)).toBe(false);
  });

  it(`accepts ${MIN_PHOTOS} photo`, () => {
    expect(isValidSelectionCount(MIN_PHOTOS)).toBe(true);
  });

  it(`accepts ${MAX_PHOTOS} photos`, () => {
    expect(isValidSelectionCount(MAX_PHOTOS)).toBe(true);
  });

  it(`rejects ${MAX_PHOTOS + 1} photos`, () => {
    expect(isValidSelectionCount(MAX_PHOTOS + 1)).toBe(false);
  });
});

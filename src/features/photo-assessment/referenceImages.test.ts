import { REFERENCE_IMAGES, getReferenceImagesForCategory } from './referenceImages';
import type { ImprovementCategory } from '../../types/domain';

const ALL_CATEGORIES: ImprovementCategory[] = [
  'light',
  'composition',
  'expression',
  'outfit',
  'background',
  'other',
];

describe('REFERENCE_IMAGES (AC-005 前提データ)', () => {
  it('has at least one illustration for each of the 6 improvement categories', () => {
    ALL_CATEGORIES.forEach((category) => {
      const count = REFERENCE_IMAGES.filter((image) => image.category === category).length;
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  it('gives every illustration a non-empty caption (言語ガイド)', () => {
    REFERENCE_IMAGES.forEach((image) => {
      expect(image.caption.length).toBeGreaterThan(0);
    });
  });
});

describe('getReferenceImagesForCategory', () => {
  it('returns the illustrations matching a known category', () => {
    const result = getReferenceImagesForCategory('light');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((image) => expect(image.category).toBe('light'));
  });

  it('AC-005 失敗時: falls back to the "other" category when given an unknown category', () => {
    const result = getReferenceImagesForCategory('does-not-exist');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((image) => expect(image.category).toBe('other'));
  });
});

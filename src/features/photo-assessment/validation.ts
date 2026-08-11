export const MIN_PHOTOS = 1;
export const MAX_PHOTOS = 5;

export function isValidSelectionCount(count: number): boolean {
  return count >= MIN_PHOTOS && count <= MAX_PHOTOS;
}

/** A page of results, numbered from 1. */
export type Page<T> = { items: T[]; page: number; pageCount: number; hasNext: boolean };

/** How many pages of `size` items it takes to show `total` items. */
export function pageCount(total: number, size: number): number {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size must be a positive integer, got ${size}`);
  if (!Number.isInteger(total) || total < 0) throw new RangeError(`total must be a non-negative integer, got ${total}`);
  return Math.round(total / size);
}

/** Page `page` (from 1) of `items`, `size` items to a page. */
export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const count = pageCount(items.length, size);
  if (!Number.isInteger(page) || page < 1) throw new RangeError(`page must be a positive integer, got ${page}`);
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), page, pageCount: count, hasNext: page < count };
}

// Hidden check for the TypeScript fixture: copied to /work/hidden_check/ only
// after the dispatch has finished. The planted bug: pageCount rounds instead of
// rounding up, so a last page holding less than half a page is dropped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageCount, paginate } from "../src/paginate.ts";

test("pageCount rounds a part-filled last page up, however few items it holds", () => {
  for (const [total, size, want] of [[11, 5, 3], [1, 5, 1], [7, 5, 2], [21, 10, 3], [101, 25, 5]] as const) {
    assert.equal(pageCount(total, size), want, `pageCount(${total}, ${size})`);
  }
});

test("pageCount is still exact on whole pages and zero", () => {
  assert.equal(pageCount(10, 5), 2);
  assert.equal(pageCount(9, 5), 2);
  assert.equal(pageCount(0, 5), 0);
});

test("paginate reaches the last item: page 2 of 11 has a next page, and page 3 holds item 11", () => {
  const items = Array.from({ length: 11 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 2, 5), { items: [6, 7, 8, 9, 10], page: 2, pageCount: 3, hasNext: true });
  assert.deepEqual(paginate(items, 3, 5), { items: [11], page: 3, pageCount: 3, hasNext: false });
});

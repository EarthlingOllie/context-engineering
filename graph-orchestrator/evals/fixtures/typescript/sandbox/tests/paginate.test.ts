import { test } from "node:test";
import assert from "node:assert/strict";
import { pageCount, paginate } from "../src/paginate.ts";

test("pageCount: an exact number of pages", () => {
  assert.equal(pageCount(10, 5), 2);
  assert.equal(pageCount(100, 25), 4);
});

test("pageCount: a part-filled last page counts as a page", () => {
  assert.equal(pageCount(9, 5), 2);
  assert.equal(pageCount(19, 10), 2);
});

test("pageCount: no items, no pages", () => {
  assert.equal(pageCount(0, 5), 0);
});

test("pageCount: size must be a positive integer", () => {
  assert.throws(() => pageCount(10, 0), RangeError);
  assert.throws(() => pageCount(10, 2.5), RangeError);
});

test("paginate: the first page and whether another follows", () => {
  const items = Array.from({ length: 10 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 1, 5), { items: [1, 2, 3, 4, 5], page: 1, pageCount: 2, hasNext: true });
});

test("paginate: the last page has no next", () => {
  const items = Array.from({ length: 10 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 2, 5), { items: [6, 7, 8, 9, 10], page: 2, pageCount: 2, hasNext: false });
});

test("paginate: page numbers start at 1", () => {
  assert.throws(() => paginate([1, 2, 3], 0, 2), RangeError);
});

# pagekit

Paging helpers for the order-history API client.

- `src/paginate.ts`: `pageCount(total, size)` and `paginate(items, page, size)`, pages numbered from 1.
- `src/fetchPage.ts`: `fetchPage(path, page, options)`, one authenticated page request.

Run the tests with `npm test` (Node's built-in test runner; Node 22 or later, no install step).

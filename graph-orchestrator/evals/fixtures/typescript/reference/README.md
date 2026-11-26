# TypeScript fixture: reference (host only, never copied into the sandbox)

`pagekit` carries two planted defects, one per sample:

- **Sample 4 (planted bug).** `pageCount` in `sandbox/src/paginate.ts` uses
  `Math.round` where it needs `Math.ceil`, so a last page holding less than half
  a page is dropped (11 items at 5 a page: 2 pages, item 11 never shown). The
  visible tests (`npm test`) only use totals that round the right way, so they
  pass. The hidden test `hidden/paginate.hidden.test.ts` catches it.
  `fixed/src/paginate.ts` is the one-line fix; `tests/test_typescript_fixture.py`
  checks the shipped code passes the visible tests and fails the hidden one, and
  the fix passes both.
- **Sample 11 (planted defect in a diff).** `sandbox/review/0001-log-page-requests.diff`
  adds request logging to `src/fetchPage.ts`. It does what it says and reads
  cleanly, but it logs the request `headers`, which hold the bearer token: a
  **security** defect. The panel must return FAIL with the `security` lens
  among the failing lenses (the check is in `samples/11-panel-diff-defect.json`).

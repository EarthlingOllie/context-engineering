# DQ-07: where should the idempotency keys live?

Status: open. Owner: Payments Platform.

## Question

The payments API stores an idempotency key for every write request, so a
client that retries after a timeout gets the first answer back instead of a
second charge. Today the keys sit in an in-process map and are lost on every
deploy. They need a shared store. Two options are on the table:

- **postgres**: a table in the ledger's PostgreSQL 16 database, written in the
  same transaction as the ledger event the request creates.
- **redis**: the Redis 7 cluster the API already uses for rate limiting, one
  key per request with a time-to-live.

## What we know

- Keys must be kept 72 hours (retry policy). About 40 million keys are live at
  any time; each key with its stored response is about 1 KB.
- Write requests peak at 2,500 per second. The ledger database peaks at 60%
  of its write capacity today.
- The Redis cluster is configured with `maxmemory-policy allkeys-lru` and runs
  at 70% of its 32 GB memory. It is not persisted: a failover loses the keys
  written since the last replica sync, usually under a second.
- A duplicate charge costs a refund, a support case and, above 0.1% of
  payments, a card-network fine. A rejected retry costs the client one more
  retry.
- The ledger team must sign off on any new table in their database.

## Decision wanted

One option, with the reason that decides it.

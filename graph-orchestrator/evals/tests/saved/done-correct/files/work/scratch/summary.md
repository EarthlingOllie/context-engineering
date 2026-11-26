# Payments docs: operational facts

- The ledger service runs on PostgreSQL 16 (ledger-service.md)
- A snapshot is taken every 500 events per account (ledger-service.md)
- Outbound card-network calls retry at most 4 times (retry-policy.md)
- Idempotency keys are kept for 72 hours (retry-policy.md)
- Settlement cut-off is 21:00 UTC (glossary.md)
- Holds expire after 7 days (glossary.md)

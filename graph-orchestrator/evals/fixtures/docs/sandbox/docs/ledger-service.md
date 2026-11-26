# Ledger service

The ledger service stores every balance change as an append-only event.
It was moved from PostgreSQL 13 to PostgreSQL 16 in March 2026.
Its on-call rotation is owned by the Payments Platform team.
Snapshots are taken every 500 events per account to keep replays fast.

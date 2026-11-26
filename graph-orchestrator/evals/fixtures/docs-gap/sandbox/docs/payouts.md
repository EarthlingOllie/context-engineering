# Payouts

Merchant balances are paid out once a day. The payout batch runs at 06:00 UTC
and covers every balance settled before the previous cut-off.

A merchant is paid only when their balance is at least 10 EUR; smaller
balances roll over to the next day's batch.

Payouts that the bank rejects are handled as the runbook
`runbooks/payout-failures.md` describes.

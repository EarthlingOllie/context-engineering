# Runbook: payout failures

A payout the bank rejects is retried 3 times, once an hour.

After the third failed retry the payout is put on hold and the finance-ops
on-call is paged; nobody retries it again until finance-ops releases the hold.

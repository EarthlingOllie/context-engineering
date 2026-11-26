# Retry policy

Outbound calls to card networks retry at most 4 times.
The backoff starts at 250 ms and doubles each attempt, capped at 4 seconds.
Idempotency keys are kept for 72 hours, so a retry after that window is a new charge.

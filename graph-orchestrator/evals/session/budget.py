"""What a session-eval run may spend (spec: a full run of the three scenarios fits $75)."""

from __future__ import annotations

BUDGET_USD = 75.0
SCENARIOS_IN_FULL_RUN = 3  # hook mid-wave, blocked to Unverified, rolling launch
DEFAULT_EPOCHS = 3
# Provisional until ticket 01's paid live run gives the cost of one session: the most a
# sample may spend so that DEFAULT_EPOCHS epochs of the three scenarios fit the budget.
DEFAULT_COST_LIMIT = 8.0

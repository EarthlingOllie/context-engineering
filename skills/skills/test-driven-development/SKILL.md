---
name: test-driven-development
description: Red, green, mutate, refactor workflow for writing or fixing code test-first.
---

Workflow Steps

1. Red (Batch per Slice): Write unit and edge-case tests for one cohesive function or feature. Run them to confirm they fail for the right reason.
2. Green: Write the simplest code to pass the batch.
3. Mutate (Verify): Temporarily break the implementation (e.g., invert a condition or alter a return value) and run the tests to prove they fail, then revert the break.
4. Refactor: Clean up code and tests, then re-run the full suite.

Rules

* Bug Fixes: Always write one failing reproduction test before fixing.
* Test at the Interface: Assert concrete inputs and outputs. Never write tautological tests that mirror implementation logic or over-mock internals.
* No Cheating: Never weaken or delete failing tests to force a pass.
* Scope Control: Do not write production code without a corresponding failing test.

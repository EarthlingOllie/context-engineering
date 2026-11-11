---
name: test-driven-development
description: Red-green-mutate-refactor loop for writing or changing code test-first. Use when building a feature or fixing a bug test-first, when the user says TDD, or when another skill asks for test-driven development.
---

# Test-driven development

Work in **slices**: one cohesive function or feature at a time. Each slice goes through four steps before the next slice starts.

## Steps

1. **Red.** Write the batch of unit and edge-case tests for the slice: the normal cases, the boundaries (empty, zero, one, many, max), and the error paths. Run them. Done when every new test fails, and fails *for the right reason*: an assertion on the missing behaviour, not an import error, typo or broken fixture.
2. **Green.** Write the simplest production code that makes the batch pass. Done when the batch is green.
3. **Mutate.** Prove the tests bite. Temporarily break the implementation: invert a condition, change a boundary (`<` to `<=`), alter a return value, drop a branch. Run the batch after each break; at least one test must go red. Revert every break. A mutation that stays green means a missing test: write it (it starts red against the mutant), revert, and repeat. Done when every mutation you tried goes red and the code is back to its green state.
4. **Refactor.** Clean up production code and tests: names, duplication, structure. Then run the full suite, not just the batch. Done when the full suite is green.

## Rules

- **Bug fixes start with a reproduction.** Write one test that fails on the bug as reported, watch it go red, then fix. The reproduction stays in the suite.
- **Test at the interface.** Assert concrete inputs against concrete outputs through the public surface a caller uses. Mock only at real boundaries (network, clock, filesystem, third-party services); keep internals real. A test that recomputes the expected value with the same logic as the code is tautological: write the literal expected value instead.
- **Failing tests are signals.** When a test fails, fix the code, or fix the test only if the test itself is wrong, and say why. Weakening or deleting a failing test to get green is never the fix.
- **Every line of production code answers a failing test.** Before writing production code, point to the red test that demands it. No red test, write one first.

---
name: test-end-to-end
description: Playwright end-to-end coverage for the current diff. Maps every path through the changed code to a user story, finds gaps in the existing Playwright tests, fills them, and runs the tests covering the diff. Use when asked to e2e test a change or check Playwright coverage of a diff.
---

# Test end to end

Cover every path through the changed code with a Playwright test a user would recognise, then run that set.

## Steps

1. **Read the diff.** The diff is the branch against its merge base with the default branch, plus uncommitted changes:

   ```bash
   git diff $(git merge-base HEAD origin/HEAD)
   ```

   If the user named a different base, use it. List each changed function, component, route or handler. Done when every changed unit with behaviour is listed.

2. **Count the paths.** For each changed unit, work out its cyclomatic complexity (decision points + 1: each `if`/`else if`, `case`, `&&`/`||`, ternary, `catch`, loop) and enumerate the paths it implies: each branch, each early return and error path, each loop at zero, one and many iterations. Follow the paths into the UI: which screen, action and state reach each one. Done when you have a table of unit → complexity → paths, and the number of paths matches the complexity.

3. **Write user stories.** One story per path, in the form *As a \<user\>, when \<state and action\>, I see \<observable outcome\>*. Several paths may collapse into one story when they produce the same observable outcome; say which. A path no user can reach through the UI (internal guard, defensive branch) gets no story: mark it **unit-test only** with the reason. Done when every path has a story or a unit-test-only reason.

4. **Map stories to existing tests.** Find the Playwright setup (`playwright.config.*`, the test directory, fixtures, page objects, auth helpers). For each story, find the test that already exercises it, reading the test, not just its title. Mark each story **covered** (name the test), **partial** (what is missing) or **gap**. Done when every story has a mark.

5. **Fill the gaps.** Write tests for every gap and partial, in the existing conventions: the same fixtures, page objects, selectors and file layout. Prefer role- and label-based locators (`getByRole`, `getByLabel`) and web-first assertions (`expect(locator).toHaveText(...)`) on what the user sees. Drive the error paths by setting up the state that triggers them (route mocks, seeded data), the same way existing tests do.

6. **Run the covering set.** Run every test mapped to a story, new and existing, and only those:

   ```bash
   npx playwright test <files or --grep> --trace off
   ```

   Use the project's own script if it has one. When a test fails, decide which side is wrong. A test bug: fix the test. A product bug: leave the test red, and report it with the path and the failing assertion. Rerun a failing test with `--trace on` to debug it. Done when every story's test has run and each is green or reported as a product bug.

## Report

End with the coverage table: path → story → test → result (pass, fail with product bug, unit-test only). Then list the files of the tests you added or changed, and the exact command that runs the set.

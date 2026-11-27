/**
 * Acceptance dispatch at finish (QUA-01 part 2, ticket 13) is SKILL.md
 * behaviour with no runtime seam, so the seam is the document: the Finish
 * section must make a spec or ticket-set session end with one acceptance
 * dispatch (panel or single) whose countable criteria are the spec's own
 * acceptance criteria, before the renderer runs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");
const finish = skill.slice(skill.indexOf("### Finish"), skill.indexOf("## Rationalizations"));

test("Finish documents the acceptance dispatch before rendering", () => {
  assert.ok(finish.startsWith("### Finish"), "Finish section present");
  const acceptance = finish.indexOf("**Acceptance dispatch.**");
  assert.ok(acceptance > 0, "acceptance dispatch named in Finish");
  assert.ok(acceptance < finish.indexOf("render-trace.js"), "acceptance dispatch comes before the renderer");
});

test("it applies to spec and ticket-set tasks and is the last wave", () => {
  assert.match(finish, /when the task is a spec or a ticket set, the last wave before rendering is one acceptance dispatch/);
  assert.match(finish, /Per-ticket passes can each be green while the spec they add up to fails/);
});

test("it is a panel or a single checking the spec's own acceptance criteria end to end", () => {
  assert.match(finish, /a `panel` \(one lens per area of the spec\) or a `single`/);
  assert.match(finish, /Its criteria are the spec's own acceptance criteria, checked end to end/);
});

test("its criteria are countable and include the full regression suite", () => {
  assert.match(finish, /each written countable as the catalog's \*\*Pass criteria\*\* defines/);
  assert.match(finish, /plus one that runs the full regression suite/);
  assert.match(finish, /A panel carries them as `pass_criteria`; a single carries them in its `task`/);
});

test("a failing criterion loops back and a budget stop leaves the criteria UNVERIFIED", () => {
  assert.match(finish, /Any failing criterion goes back on FRONTIER as a fix dispatch, after which the acceptance dispatch runs again/);
  assert.match(finish, /FRONTIER is empty only once it passes/);
  assert.match(finish, /the final reply lists the spec's acceptance criteria as UNVERIFIED/);
});

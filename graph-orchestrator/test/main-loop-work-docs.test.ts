/**
 * Evidence vs housekeeping and waiting on external state (QUA-07, COST-05)
 * are SKILL.md behaviour with no runtime seam, so the seam is the document:
 * the rule's exceptions name evidence work as a small `single` and housekeeping
 * under its two conditions, a rationalisations row answers "It's only a git
 * push", and both the exceptions and "When not to use" send waiting on a PR,
 * CI or another session to a subscription or a scheduled message.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");
const section = (heading: string) => {
  const start = skill.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing ${heading}`);
  const next = skill.indexOf("\n## ", start + heading.length + 2);
  return skill.slice(start, next < 0 ? undefined : next);
};
const rule = section("## The rule");

test("evidence work is always a single of at most 6 lines", () => {
  assert.match(rule, /\*\*Evidence work\*\* \(assessing after a restart, answering the user's question about results/);
  assert.match(rule, /always a `single` whose `returns\.maxLines` is at most 6/);
});

test("housekeeping runs in the main loop only with no dispatch running and an authorisation in the state file", () => {
  assert.match(rule, /\*\*Housekeeping\*\* \(cleanup, commit, push, PR\)/);
  assert.match(rule, /no dispatch is running, and an authorisation for that step is recorded in the state file/);
  assert.match(rule, /`AUTHORISED: <step> — <who granted it>`/);
  assert.match(rule, /irreversible step it does not name .* still asks first/);
});

test("a rationalisations row answers \"It's only a git push\"", () => {
  const row = section("## Rationalizations").split("\n").find((l) => l.startsWith(`| "It's only a git push"`)) ?? "";
  assert.match(row, /no dispatch is running/);
  assert.match(row, /`AUTHORISED:`/);
  assert.match(row, /trigger 4/);
});

test("waiting on external state is a subscription or a scheduled message, in the rule and in When not to use", () => {
  assert.match(rule, /\*\*Waiting on external state\*\* \(a PR, CI, another session\) is a subscription or a scheduled message in the main loop/);
  assert.match(rule, /Dispatch only when the check needs reading code/);
  assert.match(section("## When not to use"), /Waiting on a PR, CI or another session: that is a subscription or a scheduled message in the main loop, not a dispatch/);
});

test("the red flags allow the housekeeping exception 5 permits", () => {
  const line = section("## Red flags — stop").split("\n").find((l) => /You are about to call Read/.test(l)) ?? "";
  assert.match(line, /housekeeping that exception 5 allows/);
});

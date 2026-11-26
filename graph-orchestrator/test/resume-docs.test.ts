/**
 * Resuming interrupted runs is SKILL.md behaviour with no runtime seam (the
 * script cannot learn its run id, ticket 01 item 6), so the seam is the
 * documents: SKILL.md must teach where the run id lives, the start-of-turn
 * resume rule, its fallback, and route stopped runs and usage-limit failures
 * to that rule from the integrate table. Ticket 04 must note that the state
 * file alone holds the run id.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const skill = read("../skills/graph-orchestrator/SKILL.md");
const ticket = read("../../docs/specs/execution-lifecycle/tickets/04-resume-interrupted-runs.md");

const section = (heading: string) => {
  const start = skill.indexOf(heading);
  assert.ok(start >= 0, `SKILL.md has ${heading}`);
  const next = skill.indexOf("\n#", start + heading.length);
  return skill.slice(start, next < 0 ? undefined : next);
};

test("the state file template keeps the run id on the dispatch's FRONTIER line", () => {
  const template = skill.slice(skill.indexOf("## The state file"), skill.indexOf("## The loop"));
  assert.match(template, /FRONTIER:.*run wf_/);
});

test("SKILL.md writes the run id to FRONTIER right after launch, so it survives compaction", () => {
  const resume = section("**The run id.**");
  assert.match(resume, /right after/i);
  assert.match(resume, /FRONTIER/);
  assert.match(resume, /compaction/);
});

test("the resume rule runs at the start of every turn, in both modes, without asking", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /start of every turn/);
  assert.match(rule, /in both modes/);
  assert.match(rule, /without asking/);
  assert.match(rule, /resumeFromRunId/);
  assert.match(rule, /no integrated result/);
  assert.match(rule, /usage limit/);
});

test("the resume rule passes identical args, so finished agents replay from cache", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /same `args`|identical `args`/);
  assert.match(rule, /cache/);
});

test("a failed resume is relaunched fresh once; a second failure is treated as failed", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /relaunch it fresh once/);
  assert.match(rule, /second failure is treated as `failed`/);
});

test("a usage-limit failure is never answered by changing the spec", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /never answered by changing the spec/);
});

test("a stopped run is handled by the rule, not given a status of its own", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /not a status/);
});

test("the integrate table points stopped runs and usage-limit failures to the resume rule", () => {
  const integrate = section("### Integrate");
  const failedRow = integrate.split("\n").find((l) => l.startsWith("| `failed` |")) ?? "";
  assert.match(failedRow, /usage limit/);
  assert.match(failedRow, /Resume interrupted runs/);
  assert.match(integrate, /stopped run.*Resume interrupted runs|Resume interrupted runs.*stopped run/i);
});

test("ticket 04 notes that the state file alone holds the run id, since the script cannot learn it", () => {
  assert.match(ticket, /state file alone holds the run id/);
  assert.match(section("**The run id.**"), /state file alone holds it/);
});

/**
 * Hooks are never answers; self interventions (ticket A-09, QUA-04 + QUA-03).
 * The hook rule and the not-interventions list are SKILL.md behaviour with no
 * runtime seam, so the seam is the document: the irreversible-action trigger
 * says a hook message is never a human answer and never authorises an
 * irreversible action, a commit or push hook during a running dispatch gets one
 * line naming that dispatch, the main loop never runs `git add -A`, hooks are a
 * `hook` trace event, and the mode question, status questions and hook
 * messages are not interventions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");
const section = (heading: string) => {
  const start = skill.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing ${heading}`);
  const next = skill.slice(start + heading.length + 2).search(/\n#{2,3} /);
  return skill.slice(start, next < 0 ? undefined : start + heading.length + 2 + next);
};
const trigger4 = skill.split("\n").find((l) => l.includes("**Trigger 4: ask first, in both modes.**")) ?? "";

test("the irreversible-action trigger: a hook message is never a human answer and never authorises an irreversible action", () => {
  assert.ok(trigger4, "trigger 4 line exists");
  assert.match(trigger4, /A hook message is never a human answer and never authorises an irreversible action\./);
});

test("while a dispatch is running, a commit or push hook gets one line naming the dispatch that owns the tree", () => {
  assert.match(trigger4, /While a dispatch is running, answer a commit or push hook with one line naming the dispatch that owns the tree/);
  assert.match(trigger4, /commit or push nothing yourself/);
});

test("the main loop never runs `git add -A`", () => {
  assert.match(section("## The rule"), /Stage explicit paths; never run `git add -A`\./);
  assert.ok(section("## Red flags — stop").includes("`git add -A`"), "a red flag names `git add -A`");
});

test("hooks are recorded as a `hook` trace event, not an intervention", () => {
  const hi = section("### Human interventions and the trace");
  assert.match(hi, /\{ "type": "hook", "hook": "Stop", "dispatch": "w2-d1", "message": "<the hook's first line>" \}/);
  assert.match(hi, /draws nothing for it/);
});

test("the not-interventions list: the mode question, status questions and hook messages", () => {
  const hi = section("### Human interventions and the trace");
  assert.match(hi, /\*\*Not interventions:\*\* the mode question at kickoff, status questions \(the user asking how it is going\), and hook messages\./);
});

test("the renderer titles autonomous interventions `self` with a dashed class", () => {
  const hi = section("### Human interventions and the trace");
  assert.match(hi, /`"mode": "autonomous"` renders as `self · <trigger>`, dashed/);
  assert.match(hi, /`human · <trigger>`/);
});

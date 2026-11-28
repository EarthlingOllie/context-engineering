/**
 * Blocked evaluator and Unverified (ticket A-04, REL-08 + QUA-02).
 * Seams: the dispatch (an evaluator that blocks ends the dispatch `blocked`
 * with its question, and every evaluator prompt carries the no-unchecked-pass
 * sentence) and the documents (SKILL.md's Unverified and budget-stop rules).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spec, wave } from "./helpers.ts";

const NEW_SENTENCE =
  "If a tool needed for a criterion is denied, set blocked=true with a question naming the check that could not run. Never pass a criterion that could not be checked.";

test("dispatch: an evaluator that cannot run a check blocks the dispatch with its question, and its prompt carries the rule", async () => {
  const { out, calls, roles } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 3, pass_criteria: "1. npm test exits 0" } })],
    {
      Generator: { result: "done", artifacts: ["/scratch/t/a.js"], blocked: false },
      "Evaluator (1": { pass: false, feedback: "", blocked: true, question: "Bash was denied: could not run `npm test` for criterion 1. Allow it?" },
    },
  );
  assert.deepEqual(roles(), ["Generator (1 of 3)", "Evaluator (1 of 3)", "Checker", "Grapher"]);
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.question, "Bash was denied: could not run `npm test` for criterion 1. Allow it?");
  assert.deepEqual(r.artifacts, ["/scratch/t/a.js"]);
  const ev = calls.find((c) => (c.opts.label ?? "").startsWith("Evaluator"))!;
  assert.ok(ev.prompt.includes(NEW_SENTENCE), "evaluator prompt carries the blocked-check sentence");
  const gen = calls.find((c) => (c.opts.label ?? "").startsWith("Generator"))!;
  assert.ok(!gen.prompt.includes(NEW_SENTENCE), "only the evaluator stance carries it");
});

const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");

test("SKILL.md: a blocked result is never resolved silently, in either mode", () => {
  assert.match(skill, /A blocked result is never resolved silently, in either mode/);
});

test("SKILL.md: work accepted without a passing evaluator carries UNVERIFIED in its DECISIONS line", () => {
  assert.match(skill, /without a passing evaluator[^\n]*carries the word UNVERIFIED in its DECISIONS line/);
});

test("SKILL.md: Unverified work gets an evaluator-only dispatch next wave unless the budget is spent", () => {
  assert.match(skill, /next wave plans an evaluator-only dispatch over its artifacts unless the budget is spent/);
});

test("SKILL.md: the final reply lists Unverified items first", () => {
  const finish = skill.slice(skill.indexOf("### Finish"));
  assert.match(finish, /Your final reply is: the UNVERIFIED items first[^\n]*; then STATUS in one line/);
});

test("SKILL.md: a budget stop with a failing review ends with one single that returns its blocking items in at most 6 lines", () => {
  assert.match(skill, /A budget stop with a failing review ends with one `single` that reads the review artifact and returns its blocking items in at most 6 lines/);
});

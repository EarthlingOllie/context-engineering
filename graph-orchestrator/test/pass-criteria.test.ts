/**
 * Countable pass criteria (ticket A-03, QUA-01).
 * Seams: the dispatch (a generator-evaluator spec with no pass criteria fails
 * before any agent is spent, instead of inventing a default) and the document
 * (catalog.md's `pass_criteria` entry).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spec, wave } from "./helpers.ts";

test("dispatch: a generator-evaluator with no, empty or blank pass_criteria returns failed (\"pass_criteria missing\") and spends no agents", async () => {
  const { out, roles, calls } = await wave([
    spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 3 } }),
    spec({ id: "w1-d2", topology: "generator-evaluator", params: { pass_criteria: "" } }),
    spec({ id: "w1-d3", topology: "generator-evaluator", params: { pass_criteria: "   " } }),
    spec({ id: "w1-d4", topology: "generator-evaluator" }),
  ]);
  assert.deepEqual(roles().filter((l) => l !== "Grapher"), [], "no generator or evaluator runs");
  assert.deepEqual(out.results.map((r) => r.status), ["failed", "failed", "failed", "failed"]);
  for (const r of out.results) {
    assert.match(r.result, /pass_criteria missing/);
    assert.equal(r.iterations, 0);
  }
  assert.ok(!calls.some((c) => c.prompt.includes("the task is complete and correct")), "no invented criterion reaches any prompt");
});

test("dispatch: a generator-evaluator chain stage with no pass_criteria fails that stage without spending its agents", async () => {
  const { out, roles } = await wave(
    [spec({ id: "w1-d1", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "generator-evaluator", task: "b", params: { max_iterations: 1 } }] } })],
    { Worker: { result: "a done", artifacts: [], blocked: false } },
  );
  assert.ok(!roles().some((l) => l.startsWith("Generator") || l.startsWith("Evaluator")), "the stage spends no generator or evaluator");
  assert.equal(out.results[0]!.status, "failed");
  assert.match(out.results[0]!.result, /pass_criteria missing/);
});

test("dispatch: given pass criteria reach both roles verbatim", async () => {
  const criteria = "1. `npm test` from /work exits 0 with 0 failing tests";
  const { out, calls } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 1, pass_criteria: criteria } })],
    { Generator: { result: "ok", artifacts: [], blocked: false }, Evaluator: { pass: true, feedback: "", blocked: false } },
  );
  assert.equal(out.results[0]!.status, "done");
  const gen = calls.find((c) => (c.opts.label ?? "").startsWith("Generator"))!;
  const ev = calls.find((c) => (c.opts.label ?? "").startsWith("Evaluator"))!;
  assert.ok(gen.prompt.includes(criteria));
  assert.ok(ev.prompt.includes(criteria));
});

const catalog = readFileSync(new URL("../skills/graph-orchestrator/catalog.md", import.meta.url), "utf8");
const ge = catalog.slice(catalog.indexOf("## generator-evaluator"), catalog.indexOf("## fan-out"));

test("catalog: pass_criteria is required, and a missing one fails the dispatch with no agent spent", () => {
  assert.match(ge, /`pass_criteria` \(string, required\)/);
  assert.doesNotMatch(ge, /required in practice/);
  assert.match(ge, /`failed` \("pass_criteria missing"\) when `pass_criteria` is missing or blank, with no agent spent/);
});

test("catalog: a criterion is a numbered item naming a command or observable and its expected count or output, including the full regression suite or the later gate that runs it", () => {
  assert.match(ge, /A criterion is a numbered item that names a command or an observable and its expected count or output/);
  assert.match(ge, /One criterion runs the full regression suite, or names the later gate that runs it/);
});

test("catalog: lists the words that do not make criteria", () => {
  const line = ge.split("\n").find((l) => l.startsWith("These words do not make criteria"));
  assert.ok(line, "the do-not-use line exists");
  for (const w of ["relevant", "targeted", "touched-area", "all checks", "an except clause"]) assert.ok(line.includes(w), `names ${w}`);
});

test("catalog: shows one good example of countable criteria", () => {
  const m = ge.match(/Good: `([^`]+)`/);
  assert.ok(m, "a Good: example exists");
  assert.match(m[1]!, /^1\. /);
  assert.match(m[1]!, /2\. /);
  assert.match(m[1]!, /full suite/);
  // the worked JSON example uses countable criteria too
  const json = ge.match(/"pass_criteria": "([^"]+)"/);
  assert.ok(json && /^1\. /.test(json[1]!), "the JSON example's pass_criteria is numbered");
});

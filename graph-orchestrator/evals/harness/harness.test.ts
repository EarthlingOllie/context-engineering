/**
 * The harness runs the built workflows/dispatch.js the way the Workflow
 * harness does, on the real Runtime, and produces the result file the Inspect
 * task reads. The engine is a stub: no model call is made.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadBundle, runHarness } from "./harness.ts";
import type { Engine, EngineRequest } from "./runtime.ts";

const bundleSource = readFileSync(new URL("../../workflows/dispatch.js", import.meta.url), "utf8");
const sample1 = JSON.parse(readFileSync(new URL("../samples/01-single-docs.json", import.meta.url), "utf8")) as { args: Record<string, unknown> };

/** Worker and scribe answers, as the real engine would return them through the schema. */
function stubEngine(t: { v: number }) {
  const seen: EngineRequest[] = [];
  const engine: Engine = async (req) => {
    seen.push(req);
    t.v += 1000;
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    return { output: { result: "/work/scratch/summary.md\nPostgreSQL 16 (ledger-service.md)", artifacts: ["/work/scratch/summary.md"], blocked: false } };
  };
  return { engine, seen };
}

test("the bundle is split into its meta literal and a body run under the harness globals", () => {
  const b = loadBundle(bundleSource);
  assert.equal(b.meta["name"], "dispatch");
  assert.equal(typeof b.run, "function");
});

test("a bundle that does not begin with the meta literal is refused", () => {
  assert.throws(() => loadBundle("return 1"), /meta literal/);
});

test("sample 1 runs through the shipped bundle: every role on the main model, schema passed, result file written as data", async () => {
  const t = { v: 0 };
  const { engine, seen } = stubEngine(t);
  const result = await runHarness({ bundleSource, args: sample1.args, engine, mainModel: "claude-opus-5-5", cap: 2, now: () => t.v });

  assert.equal(result.error, null);
  assert.equal(result.return?.["status"], "done");
  assert.equal(result.return?.["id"], "w1-d1");
  assert.deepEqual(result.return?.["scribe"], { appended: 1, totalLines: 1 });
  assert.equal(result.mainModel, "claude-opus-5-5");
  assert.equal(result.cap, 2);
  assert.equal(result.wallClockMs, 2000);

  assert.deepEqual(
    seen.map((r) => [r.model, typeof r.schema]),
    [
      ["claude-opus-5-5", "object"],
      ["claude-opus-5-5", "object"],
    ],
  );
  assert.deepEqual(
    result.agents.map((a) => [a.label?.split(":")[0], a.model, a.startMs, a.endMs]),
    [
      ["Worker", "claude-opus-5-5", 0, 1000],
      ["Grapher", "claude-opus-5-5", 1000, 2000],
    ],
  );
  assert.match(result.logs[0]!.message, /^w1-d1: single, up to 1 agent\(s\) \+ 1 scribe$/);
});

test("an engine failure reaches the plugin as nothing returned: the dispatch fails and the harness still writes its result", async () => {
  const engine: Engine = async (req) => {
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    throw new Error("engine result error_during_execution");
  };
  const result = await runHarness({ bundleSource, args: sample1.args, engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.error, null);
  assert.equal(result.return?.["status"], "failed");
  assert.equal(result.agents[0]!.error, "engine result error_during_execution");
});

const sampleArgs = (file: string) => (JSON.parse(readFileSync(new URL(`../samples/${file}`, import.meta.url), "utf8")) as { args: Record<string, unknown> }).args;

test("sample 15 (fan-out split of 10) comes back over_budget without spending a dispatch agent: only the scribe runs", async () => {
  const { engine, seen } = stubEngine({ v: 0 });
  const result = await runHarness({ bundleSource, args: sampleArgs("15-fan-out-over-budget.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.error, null);
  assert.equal(result.return?.["status"], "over_budget");
  assert.equal(result.return?.["iterations"], 0);
  assert.deepEqual(seen.map((r) => r.label?.split(":")[0]), ["Grapher"]);
});

test("sample 7 (fan-out partitioned six ways) runs the partition and 6 branches under cap 2, and the branches past the cap record queue time", async () => {
  let running = 0;
  let peak = 0;
  const engine: Engine = async (req) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    if (req.label?.startsWith("Partition")) return { output: { subtasks: [1, 2, 3, 4, 5, 6].map((i) => `part ${i}`), blocked: false } };
    return { output: { result: "Holds expire after 7 days (glossary.md)", artifacts: [], blocked: false } };
  };
  const result = await runHarness({ bundleSource, args: sampleArgs("07-fan-out-partition-docs.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.deepEqual(result.agents.map((a) => a.label?.split(/[ :]/)[0]), ["Partition", ...Array(6).fill("Worker"), "Grapher"]);
  assert.equal(peak, 2);
  const branches = result.agents.filter((a) => a.label?.startsWith("Worker"));
  assert.ok(branches.filter((a) => (a.queuedMs ?? 0) > 0).length >= 4, "branches beyond the cap wait for a slot");
  assert.ok(result.wallClockMs >= 15);
});

test("sample 2 (single over the blocked-task fixture) returns blocked with the worker's question", async () => {
  const engine: Engine = async (req) => {
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    return { output: { result: "", artifacts: [], blocked: true, question: "What settlement cut-off did the bank sign?" } };
  };
  const result = await runHarness({ bundleSource, args: sampleArgs("02-single-blocked.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "blocked");
  assert.equal(result.return?.["question"], "What settlement cut-off did the bank sign?");
});

test("sample 6 (fan-out with an explicit list and a reducer) runs one branch per file, then the reducer, whose result is the dispatch's", async () => {
  const engine: Engine = async (req) => {
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    if (req.label?.startsWith("Reducer")) return { output: { result: "merged (glossary.md)", artifacts: [], blocked: false } };
    return { output: { result: "a fact (x.md)", artifacts: [], blocked: false } };
  };
  const result = await runHarness({ bundleSource, args: sampleArgs("06-fan-out-reducer-docs.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.equal(result.return?.["result"], "merged (glossary.md)");
  assert.deepEqual(result.agents.map((a) => a.label?.split(/[ :]/)[0]), ["Worker", "Worker", "Worker", "Reducer", "Grapher"]);
});

/** A stub engine that records each request and answers generator, evaluator, worker and scribe. */
function roleEngine(evaluatorPasses: boolean) {
  const seen: EngineRequest[] = [];
  const engine: Engine = async (req) => {
    seen.push(req);
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    if (/Evaluator/.test(req.label ?? "")) return { output: evaluatorPasses ? { pass: true, feedback: "", blocked: false } : { pass: false, feedback: "1. parse_duration('1m') must also return 90", blocked: false } };
    return { output: { result: "retrykit/duration.py\n12 passed", artifacts: [], blocked: false } };
  };
  return { engine, seen };
}
const roleOf = (label: string | null) => (label ?? "").replace(/^Link [\d.]+(?: · [^,]+)?, /, "").split(/[ :]/)[0];

test("sample 3 (generator-evaluator on the Python fixture): the generator prompt names test-driven-development and the evaluator prompt code-review", async () => {
  const { engine, seen } = roleEngine(true);
  const result = await runHarness({ bundleSource, args: sampleArgs("03-generator-evaluator-python.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.deepEqual(result.agents.map((a) => roleOf(a.label)), ["Generator", "Evaluator", "Grapher"]);
  assert.match(seen[0]!.prompt, /SKILL: load and follow the skill `test-driven-development`/);
  assert.match(seen[1]!.prompt, /SKILL: load and follow the skill `code-review`/);
});

test("sample 5 (unmeetable criteria, 2 rounds) returns exhausted after 2 generator and 2 evaluator runs", async () => {
  const { engine } = roleEngine(false);
  const result = await runHarness({ bundleSource, args: sampleArgs("05-generator-evaluator-exhausted.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "exhausted");
  assert.equal(result.return?.["iterations"], 2);
  assert.match(String(result.return?.["result"]), /-- exhausted after 2 round\(s\)/);
  assert.deepEqual(result.agents.map((a) => roleOf(a.label)), ["Generator", "Evaluator", "Generator", "Evaluator", "Grapher"]);
});

test("sample 8 (chain: single then generator-evaluator) completes both stages, each role carrying its skill", async () => {
  const { engine, seen } = roleEngine(true);
  const result = await runHarness({ bundleSource, args: sampleArgs("08-chain-single-then-ge-python.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.deepEqual(result.return?.["stages"], ["w1-d8-s1:done", "w1-d8-s2:done"]);
  assert.deepEqual(result.agents.map((a) => roleOf(a.label)), ["Worker", "Generator", "Evaluator", "Grapher"]);
  assert.match(seen[1]!.prompt, /skill `test-driven-development`/);
  assert.match(seen[2]!.prompt, /skill `code-review`/);
});

test("sample 9 (chain whose stage 2 cannot pass) stops at stage 2, reports it and its status, and never runs stage 3", async () => {
  const { engine } = roleEngine(false);
  const result = await runHarness({ bundleSource, args: sampleArgs("09-chain-stage-2-fails.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "exhausted");
  assert.deepEqual(result.return?.["stages"], ["w1-d9-s1:done", "w1-d9-s2:exhausted"]);
  assert.match(String(result.return?.["result"]), /^stage w1-d9-s2 exhausted: /);
  assert.ok(!result.agents.some((a) => a.label?.startsWith("Link 3")));
  assert.deepEqual(result.agents.map((a) => roleOf(a.label)), ["Worker", "Generator", "Evaluator", "Grapher"]);
});

test("sample 4 (generator-evaluator, vague criteria, TypeScript fixture): an evaluator that passes ends the loop at once with done, the roles carrying their skills", async () => {
  const { engine, seen } = roleEngine(true);
  const result = await runHarness({ bundleSource, args: sampleArgs("04-generator-evaluator-false-pass.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.equal(result.return?.["iterations"], 1);
  assert.deepEqual(result.agents.map((a) => roleOf(a.label)), ["Generator", "Evaluator", "Grapher"]);
  assert.match(seen[0]!.prompt, /skill `test-driven-development`/);
  assert.match(seen[1]!.prompt, /skill `code-review`/);
  assert.match(seen[1]!.prompt, /The relevant tests pass\./);
});

test("sample 11 (panel of 3 lenses over the diff): one evaluator per lens, and a failing security lens is named in the FAIL verdict within the line limit", async () => {
  const seen: EngineRequest[] = [];
  const engine: Engine = async (req) => {
    seen.push(req);
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    const security = /LENS: security/.test(req.prompt);
    return { output: { pass: !security, feedback: security ? "1. the new log line writes the request headers, bearer token included" : "", blocked: false } };
  };
  const result = await runHarness({ bundleSource, args: sampleArgs("11-panel-diff-defect.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.equal(result.return?.["result"], "FAIL (2/3)\n[security] FAIL: 1. the new log line writes the request headers, bearer token included");
  assert.deepEqual(result.agents.map((a) => a.label?.split(" (")[0]), ["Evaluator correctness", "Evaluator security", "Evaluator readability", "Grapher: logging current dispatch"]);
  assert.ok(seen.slice(0, 3).every((r) => /skill `code-review`/.test(r.prompt) && /0001-log-page-requests\.diff/.test(r.prompt)));
});

test("sample 11 with every lens failing still names all three lenses: the line limit leaves room for the verdict and each lens", async () => {
  const engine: Engine = async (req) => {
    if (req.label?.startsWith("Grapher")) return { output: { appended: 1, totalLines: 1 } };
    return { output: { pass: false, feedback: "1. no", blocked: false } };
  };
  const result = await runHarness({ bundleSource, args: sampleArgs("11-panel-diff-defect.json"), engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.deepEqual(String(result.return?.["result"]).split("\n").map((l) => l.split(":")[0]), ["FAIL (0/3)", "[correctness] FAIL", "[security] FAIL", "[readability] FAIL"]);
});

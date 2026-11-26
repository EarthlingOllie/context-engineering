/**
 * The canned engine behind `main.ts --stub`: no model call. Its evaluator
 * passes by default; `evaluator: "fail"` makes every evaluator fail, so the
 * dry run reaches `exhausted` the way samples 5 and 9 must.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHarness } from "./harness.ts";
import { stubEngine } from "./stub-engine.ts";

const bundleSource = readFileSync(new URL("../../workflows/dispatch.js", import.meta.url), "utf8");
const sampleArgs = (file: string, scratch: string) => {
  const args = (JSON.parse(readFileSync(new URL(`../samples/${file}`, import.meta.url), "utf8")) as { args: Record<string, unknown> }).args;
  return { ...args, scratch };
};

test("with a passing evaluator the stub finishes sample 3 in one round, and its scribe writes the trace file", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "stub-"));
  const result = await runHarness({ bundleSource, args: sampleArgs("03-generator-evaluator-python.json", scratch), engine: stubEngine(), mainModel: "m", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.equal(result.return?.["iterations"], 1);
  assert.ok(readFileSync(join(scratch, "trace", "w1-d3.jsonl"), "utf8").includes('"status":"done"'));
});

test("with a failing evaluator the stub ends sample 5 exhausted after its 2 rounds and sample 9 at stage 2", async () => {
  const s5 = await runHarness({ bundleSource, args: sampleArgs("05-generator-evaluator-exhausted.json", mkdtempSync(join(tmpdir(), "stub-"))), engine: stubEngine({ evaluator: "fail" }), mainModel: "m", cap: 2 });
  assert.equal(s5.return?.["status"], "exhausted");
  assert.equal(s5.return?.["iterations"], 2);
  const s9 = await runHarness({ bundleSource, args: sampleArgs("09-chain-stage-2-fails.json", mkdtempSync(join(tmpdir(), "stub-"))), engine: stubEngine({ evaluator: "fail" }), mainModel: "m", cap: 2 });
  assert.deepEqual(s9.return?.["stages"], ["w1-d9-s1:done", "w1-d9-s2:exhausted"]);
});

test("the stub reports each call as served on the model requested, or with `serveModel` on that model whatever was requested", async () => {
  const args = sampleArgs("03-generator-evaluator-python.json", mkdtempSync(join(tmpdir(), "stub-")));
  const honest = await runHarness({ bundleSource, args, engine: stubEngine(), mainModel: "claude-opus-5-5", cap: 2, roleModels: { evaluator: "claude-haiku-5-5" } });
  assert.deepEqual(
    honest.agents.map((a) => [a.role, a.model, (a.engine as { calls: Array<{ model: string }> }).calls.map((c) => c.model)]),
    [
      ["generator", "claude-opus-5-5", ["claude-opus-5-5"]],
      ["evaluator", "claude-haiku-5-5", ["claude-haiku-5-5"]],
      ["scribe", "claude-opus-5-5", ["claude-opus-5-5"]],
    ],
  );
  const args2 = sampleArgs("03-generator-evaluator-python.json", mkdtempSync(join(tmpdir(), "stub-")));
  const fallback = await runHarness({ bundleSource, args: args2, engine: stubEngine({ serveModel: "claude-opus-5-5" }), mainModel: "claude-opus-5-5", cap: 2, roleModels: { evaluator: "claude-haiku-5-5" } });
  const ev = fallback.agents.find((a) => a.role === "evaluator")!;
  assert.equal(ev.model, "claude-haiku-5-5");
  assert.deepEqual((ev.engine as { calls: Array<{ model: string }> }).calls.map((c) => c.model), ["claude-opus-5-5"]);
});

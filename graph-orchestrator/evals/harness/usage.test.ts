/**
 * Ticket B-05 in the eval harness: the fake Workflow runtime offers the
 * `budget` global with `spent()` (output tokens of the agents answered so
 * far, from the engine's per-call usage), and the shipped bundle reads it, so
 * a dispatch line written under the harness carries the per-agent output
 * tokens the stub engine reported.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "./runtime.ts";
import { runHarness } from "./harness.ts";
import { stubEngine } from "./stub-engine.ts";

const bundleSource = readFileSync(new URL("../../workflows/dispatch.js", import.meta.url), "utf8");
const sampleArgs = (file: string) => (JSON.parse(readFileSync(new URL(`../samples/${file}`, import.meta.url), "utf8")) as { args: Record<string, unknown> }).args;

test("the runtime's budget.spent() is the output tokens the engine reported for every answered call", async () => {
  const { runtime } = createRuntime({ engine: stubEngine({ outputTokens: 250 }), mainModel: "m", cap: 2 });
  assert.equal(runtime.budget?.spent?.(), 0);
  await runtime.agent("ROLE: worker", { label: "Worker: x" });
  assert.equal(runtime.budget?.spent?.(), 250);
  await runtime.agent("ROLE: worker", { label: "Worker: y" });
  assert.equal(runtime.budget?.spent?.(), 500);
});

test("a stub without outputTokens reports no usage, so spent() stays 0", async () => {
  const { runtime } = createRuntime({ engine: stubEngine(), mainModel: "m", cap: 1 });
  await runtime.agent("ROLE: worker", { label: "Worker: x" });
  assert.equal(runtime.budget?.spent?.(), 0);
});

test("sample 3 through the shipped bundle: the dispatch line records each agent's role and the output tokens the stub reported", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "b05-"));
  const args = { ...sampleArgs("03-generator-evaluator-python.json"), scratch };
  const result = await runHarness({ bundleSource, args, engine: stubEngine({ outputTokens: 400 }), mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(result.error, null);
  assert.equal(result.return?.["status"], "done");
  const lines = readFileSync(join(scratch, "trace", "w1-d3.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
  const line = lines.find((e) => e["type"] === "dispatch")!;
  assert.deepEqual(line["agents"], [
    { role: "generator", output_tokens: 400 },
    { role: "evaluator", output_tokens: 400 },
  ]);
  assert.equal(line["concurrency"], 1);
  assert.equal(typeof line["demand"], "number");
});

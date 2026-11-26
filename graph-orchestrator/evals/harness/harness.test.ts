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

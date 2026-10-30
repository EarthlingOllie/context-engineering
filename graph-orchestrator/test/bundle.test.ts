/**
 * Runs the built workflows/wave.js the way the Workflow harness does: the
 * `export const meta` literal is read on its own, and the rest is executed as
 * the body of an async function whose parameters are the harness globals.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeRuntime, spec, baseArgs } from "./helpers.ts";

const source = readFileSync(new URL("../workflows/wave.js", import.meta.url), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...a: string[]) => (...b: unknown[]) => Promise<unknown>;

function splitScript(src: string): { meta: Record<string, unknown>; body: string } {
  assert.ok(src.startsWith("export const meta = {"), "script begins with the meta literal");
  const end = src.indexOf("\n}\n");
  const literal = src.slice("export const meta = ".length, end + 2);
  const meta = new Function(`return (${literal});`)() as Record<string, unknown>;
  return { meta, body: src.slice(end + 3) };
}

test("the bundle is one plain script: meta literal first, no imports or requires, no clock or randomness", () => {
  const { meta, body } = splitScript(source);
  assert.equal(meta["name"], "wave");
  assert.equal(typeof meta["description"], "string");
  assert.ok(Array.isArray(meta["phases"]));
  assert.doesNotMatch(body, /^\s*import\b/m);
  assert.doesNotMatch(body, /^\s*export\b/m);
  assert.doesNotMatch(body, /\brequire\(/);
  assert.doesNotMatch(body, /Date\.now\(|Math\.random\(|new Date\(\)/);
  assert.match(body, /return await runWave\(args, \{ agent, parallel, log \}\);\s*$/);
});

test("the script body runs under a harness-shaped scope and returns the wave as data", async () => {
  const { body } = splitScript(source);
  const run = new AsyncFunction("agent", "parallel", "log", "phase", "pipeline", "workflow", "budget", "args", body);
  const f = fakeRuntime({ worker: { result: "/scratch/t/out.md\nsummary", artifacts: ["/scratch/t/out.md"], blocked: false } });
  const args = {
    ...baseArgs,
    dispatches: [
      spec({ id: "w1-d1", topology: "single", task: "Write the thing" }),
      spec({ id: "w1-d2", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "generator-evaluator", task: "b", params: { max_iterations: 1, pass_criteria: "ok" } }] } }),
    ],
  };
  const out = (await run(f.rt.agent, f.rt.parallel, f.rt.log, () => {}, () => {}, () => {}, { total: null }, args)) as {
    status: string;
    results: Array<{ id: string; status: string; stages?: string[] }>;
    events: unknown[];
    scribe: { appended: number } | null;
  };
  assert.equal(out.status, "done");
  assert.deepEqual(
    out.results.map((r) => [r.id, r.status]),
    [
      ["w1-d1", "done"],
      ["w1-d2", "done"],
    ],
  );
  assert.deepEqual(out.results[1]!.stages, ["w1-d2-s1:done", "w1-d2-s2:done"]);
  assert.equal(out.scribe?.appended, 6);
  assert.ok(f.logs[0]!.startsWith("wave 1: 2 dispatch(es), demand 5 agent(s)"));
});

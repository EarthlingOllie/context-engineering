/**
 * Runs the built workflows/dispatch.js the way the Workflow harness does: the
 * `export const meta` literal is read on its own, and the rest is executed as
 * the body of an async function whose parameters are the harness globals.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeRuntime, spec, baseArgs } from "./helpers.ts";

const source = readFileSync(new URL("../workflows/dispatch.js", import.meta.url), "utf8");
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
  assert.equal(meta["name"], "dispatch");
  assert.equal(typeof meta["description"], "string");
  assert.doesNotMatch(body, /^\s*import\b/m);
  assert.doesNotMatch(body, /^\s*export\b/m);
  assert.doesNotMatch(body, /\brequire\(/);
  assert.doesNotMatch(body, /Date\.now\(|Math\.random\(|new Date\(\)/);
  assert.match(body, /return await runWorkflow\(args, \{ agent, parallel, log \}\);\s*$/);
});

test("the script body runs under a harness-shaped scope and returns the dispatch's result as data", async () => {
  const { body } = splitScript(source);
  const run = new AsyncFunction("agent", "parallel", "log", "phase", "pipeline", "workflow", "budget", "args", body);
  const f = fakeRuntime({ Worker: { result: "/scratch/t/out.md\nsummary", artifacts: ["/scratch/t/out.md"], blocked: false } });
  const args = {
    ...baseArgs,
    dispatch: spec({ id: "w1-d2", title: "Write and review the thing", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "generator-evaluator", task: "b", params: { max_iterations: 1, pass_criteria: "ok" } }] } }),
  };
  const out = (await run(f.rt.agent, f.rt.parallel, f.rt.log, () => {}, () => {}, () => {}, { total: null }, args)) as {
    id: string;
    title?: string;
    status: string;
    stages?: string[];
    scribe: { appended: number } | null;
  };
  assert.equal(out.id, "w1-d2");
  assert.equal(out.title, "Write and review the thing");
  assert.equal(out.status, "done");
  assert.deepEqual(out.stages, ["w1-d2-s1:done", "w1-d2-s2:done"]);
  assert.equal(out.scribe?.appended, 3);
  assert.deepEqual(f.labels(), ["Stage 1 · Worker", "Stage 2 · Generator · round 1 of 1", "Stage 2 · Evaluator · round 1 of 1", "Trace scribe"]);
  assert.equal(f.logs[0], "w1-d2: chain, up to 3 agent(s) + 1 scribe");
});

test("the wrapper the orchestrator writes: a named meta and one nested workflow() call that passes args through", async () => {
  const wrapper = `export const meta = { name: 'Add HTTP retry policy', description: 'w1-d1 · single' }
return await workflow({ scriptPath: '/plugin/workflows/dispatch.js' }, args)`;
  const { meta, body } = splitScript(wrapper.replace("description: 'w1-d1 · single' }", "description: 'w1-d1 · single',\n}"));
  assert.equal(meta["name"], "Add HTTP retry policy");
  const run = new AsyncFunction("workflow", "args", body);
  const seen: unknown[] = [];
  const out = await run(async (ref: unknown, a: unknown) => (seen.push(ref, a), "child result"), { dispatch: { id: "w1-d1" } });
  assert.equal(out, "child result");
  assert.deepEqual(seen, [{ scriptPath: "/plugin/workflows/dispatch.js" }, { dispatch: { id: "w1-d1" } }]);
});

/**
 * Ticket B-05: each dispatch line records, per agent, its role and the usage
 * a Workflow script can read (ticket 02: output tokens from a `budget.spent()`
 * delta, and only for an agent that ran alone; anything unreadable is left out,
 * not zeroed), plus the agents the dispatch needed (`demand`) and the most run
 * at once (`concurrency`). Tested at the dispatch seam: runWorkflow over a
 * fake runtime.
 */
import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import type { DispatchSpec, Runtime, TraceEvent } from "../src/types.ts";
import { runWorkflow } from "../src/run.ts";
import { parseTrace, renderTrace } from "../src/trace/render.ts";
import { baseArgs, eventsOf, fakeRuntime, roleOf, spec, type Script } from "./helpers.ts";

type DispatchLine = Extract<TraceEvent, { type: "dispatch" }>;

/**
 * Run one dispatch on the fake runtime with a fake `budget` whose spent()
 * grows by `tokens[role]` when an agent of that role answers (a role with no
 * entry spends 0). `budget: false` gives a runtime without one.
 */
async function runOne(d: DispatchSpec, script: Script, o: { tokens?: Record<string, number>; budget?: boolean } = {}) {
  const f = fakeRuntime(script);
  const base = f.runtimeFor(d.id);
  let spent = 0;
  const rt: Runtime = {
    ...base,
    agent: async (prompt, opts) => {
      const out = await base.agent(prompt, opts);
      await new Promise((r) => setTimeout(r, 1)); // let parallel siblings start before this one answers
      const role = roleOf(opts?.label).replace(/ .*/, "").toLowerCase();
      spent += o.tokens?.[role] ?? 0;
      return out;
    },
    ...(o.budget === false ? {} : { budget: { spent: () => spent } }),
  };
  const ret = await runWorkflow({ ...baseArgs, dispatch: d } as never, rt);
  const scribe = f.calls.find((c) => roleOf(c.opts.label) === "Grapher");
  const events = scribe ? eventsOf(scribe.prompt) : [];
  const line = events.find((e): e is DispatchLine => e.type === "dispatch" && !e.parent);
  return { ret, line, calls: f.calls, events };
}

test("dispatch line: a sequential dispatch records each agent's role and output tokens, the demand, and one agent at a time", async () => {
  const { line } = await runOne(
    spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 3, pass_criteria: "tests pass" } }),
    { "Evaluator (1": { pass: false, feedback: "1. fix it", blocked: false }, "Evaluator (2": { pass: true, feedback: "", blocked: false } },
    { tokens: { generator: 1200, evaluator: 300 } },
  );
  assert.ok(line, "a dispatch line was written");
  assert.deepEqual(line.agents, [
    { role: "generator", output_tokens: 1200 },
    { role: "evaluator", output_tokens: 300 },
    { role: "generator", output_tokens: 1200 },
    { role: "evaluator", output_tokens: 300 },
  ]);
  assert.equal(line.demand, 6, "generator-evaluator with 3 iterations may need 6 agents");
  assert.equal(line.concurrency, 1);
});

test("dispatch line: agents that overlapped get no output tokens (the shared pool cannot split them); the ones that ran alone keep theirs", async () => {
  const { line } = await runOne(
    spec({ id: "w1-d1", topology: "fan-out", params: { split: ["part a", "part b", "part c"], reducer: true } }),
    { Reducer: { result: "merged", artifacts: [], blocked: false } },
    { tokens: { worker: 500, reducer: 80 } },
  );
  assert.ok(line);
  assert.deepEqual(line.agents, [{ role: "worker" }, { role: "worker" }, { role: "worker" }, { role: "reducer", output_tokens: 80 }]);
  assert.equal(line.concurrency, 3);
  assert.equal(line.demand, 4);
});

test("dispatch line: a runtime with no readable budget leaves output tokens out rather than writing 0", async () => {
  const { line } = await runOne(spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 1, pass_criteria: "x" } }), {}, { budget: false });
  assert.ok(line);
  assert.deepEqual(line.agents, [{ role: "generator" }, { role: "evaluator" }]);
  for (const a of line.agents ?? []) assert.equal("output_tokens" in a, false);
  assert.equal(line.demand, 2);
  assert.equal(line.concurrency, 1);
});

test("dispatch line: a dispatch refused before any agent ran records no agents, its demand and zero concurrency", async () => {
  const { line, ret } = await runOne(spec({ id: "w1-d1", topology: "fan-out", params: { split: Array.from({ length: 10 }, (_, i) => `p${i}`) } }), {});
  assert.equal(ret.status, "over_budget");
  assert.ok(line);
  assert.deepEqual(line.agents, []);
  assert.equal(line.demand, 0);
  assert.equal(line.concurrency, 0);
});

test("dispatch line: chain stages' agents are recorded on the parent line, named by their role", async () => {
  const stage = (n: number): DispatchSpec => spec({ id: `w1-d1-s${n}`, topology: "single", task: `stage ${n}` });
  const { line, events } = await runOne(spec({ id: "w1-d1", topology: "chain", params: { stages: [stage(1), stage(2)] } }), {}, { tokens: { worker: 40 } });
  assert.ok(line);
  assert.deepEqual(line.agents, [
    { role: "worker", output_tokens: 40 },
    { role: "worker", output_tokens: 40 },
  ]);
  assert.equal(line.concurrency, 1);
  const stageLines = events.filter((e): e is DispatchLine => e.type === "dispatch" && !!e.parent);
  assert.equal(stageLines.length, 2);
  for (const s of stageLines) assert.equal("agents" in s, false, "stage lines carry no per-agent fields");
});

test("dispatch line: a single's worker writes the line itself with its role (its own usage is not known yet) and no scribe runs", async () => {
  const f = fakeRuntime({ Worker: { result: "ok", artifacts: [], blocked: false, traceAppended: 1, traceTotalLines: 1 } });
  const base = f.runtimeFor("w1-d1");
  let spent = 0;
  const rt: Runtime = { ...base, agent: async (p, o) => ((spent += 700), base.agent(p, o)), budget: { spent: () => spent } };
  const ret = await runWorkflow({ ...baseArgs, dispatch: spec({ id: "w1-d1", topology: "single" }) } as never, rt);
  assert.equal(ret.tracedBy, "worker");
  assert.equal(f.calls.length, 1, "no scribe");
  const traced = /<<<TRACE\n([\s\S]*?)\nTRACE>>>/.exec(f.calls[0]!.prompt)![1]!.split("\n").map((l) => JSON.parse(l) as TraceEvent);
  const line = traced.find((e): e is DispatchLine => e.type === "dispatch")!;
  assert.deepEqual(line.agents, [{ role: "worker" }]);
  assert.equal(line.demand, 1);
  assert.equal(line.concurrency, 1);
});

// ---------- render seam ----------

test("render: a trace whose lines carry agents, demand and concurrency draws the same diagram as the old lines without them; old traces still render", () => {
  const old = readFileSync(new URL("./fixtures/single-wave.jsonl", import.meta.url), "utf8");
  const withUsage = old
    .split("\n")
    .map((l) => {
      if (!l.trim()) return l;
      const e = JSON.parse(l) as Record<string, unknown>;
      return e["type"] === "dispatch" ? JSON.stringify({ ...e, agents: [{ role: "worker", output_tokens: 900 }, { role: "evaluator" }], demand: 6, concurrency: 1 }) : l;
    })
    .join("\n");
  assert.notEqual(withUsage, old);
  const before = renderTrace(old);
  assert.match(before, /^flowchart TD/);
  assert.equal(renderTrace(withUsage), before);
  assert.equal(parseTrace(withUsage).skipped, 0);
  // Malformed per-agent fields do not cost the line.
  const odd = old.replace('"type":"dispatch"', '"type":"dispatch","agents":"lots","demand":"x","concurrency":null');
  assert.equal(parseTrace(odd).skipped, 0);
  assert.equal(renderTrace(odd), before);
});

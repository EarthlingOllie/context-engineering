/**
 * The eval harness's real Runtime, driven by a stub engine in place of the
 * Claude Agent SDK. No model call is made.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRuntime, roleOf, type Engine, type EngineRequest } from "./runtime.ts";

const SCHEMA = { type: "object", properties: { result: { type: "string" } }, required: ["result"] };

function recordingEngine(reply: unknown = { result: "ok" }) {
  const seen: EngineRequest[] = [];
  const engine: Engine = async (req) => {
    seen.push(req);
    return { output: reply };
  };
  return { engine, seen };
}

test("the schema and the prompt reach the engine, and the engine's output is what agent() returns", async () => {
  const { engine, seen } = recordingEngine({ result: "summary written" });
  const { runtime } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2 });
  const out = await runtime.agent("do the thing", { label: "Worker: do the thing", schema: SCHEMA });
  assert.deepEqual(out, { result: "summary written" });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.prompt, "do the thing");
  assert.deepEqual(seen[0]!.schema, SCHEMA);
  assert.equal(seen[0]!.label, "Worker: do the thing");
});

test("a role with no requested model runs on the run's main model; a requested model is passed through", async () => {
  const { engine, seen } = recordingEngine();
  const { runtime, agents } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2 });
  await runtime.agent("a", { label: "Worker: a" });
  await runtime.agent("b", { label: "Worker: b", model: "claude-haiku-5-5" });
  assert.deepEqual(
    seen.map((r) => r.model),
    ["claude-opus-5-5", "claude-haiku-5-5"],
  );
  assert.deepEqual(
    agents.map((a) => a.model),
    ["claude-opus-5-5", "claude-haiku-5-5"],
  );
});

test("each agent's start, end and queue time are recorded on the run's clock", async () => {
  let t = 0;
  const engine: Engine = async () => {
    t += 250;
    return { output: { result: "ok" }, record: { turns: 3 } };
  };
  const { runtime, agents } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2, now: () => t });
  t = 100;
  await runtime.agent("a", { label: "Worker: a" });
  await runtime.agent("b", { label: "Grapher: logging current dispatch" });
  assert.deepEqual(
    agents.map(({ n, label, startMs, endMs, queuedMs, error, engine: rec }) => ({ n, label, startMs, endMs, queuedMs, error, rec })),
    [
      { n: 1, label: "Worker: a", startMs: 100, endMs: 350, queuedMs: 0, error: null, rec: { turns: 3 } },
      { n: 2, label: "Grapher: logging current dispatch", startMs: 350, endMs: 600, queuedMs: 0, error: null, rec: { turns: 3 } },
    ],
  );
});

test("an engine that throws surfaces as a thrown error from agent(), recorded on the agent", async () => {
  const engine: Engine = async () => {
    throw new Error("engine result error_max_turns");
  };
  const { runtime, agents } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2 });
  await assert.rejects(runtime.agent("a", { label: "Worker: a" }), /error_max_turns/);
  assert.equal(agents[0]!.error, "engine result error_max_turns");
  assert.equal(typeof agents[0]!.endMs, "number");
});

test("an engine that returns no output surfaces as nothing returned", async () => {
  const engine: Engine = async () => ({ output: undefined });
  const { runtime } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2 });
  assert.equal(await runtime.agent("a", { label: "Worker: a" }), null);
});

test("parallel() returns null for a thunk that threw and keeps the others' results in order", async () => {
  const { engine } = recordingEngine({ result: "ok" });
  const { runtime } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2 });
  const out = await runtime.parallel([async () => "a", async () => { throw new Error("boom"); }, async () => "c"]);
  assert.deepEqual(out, ["a", null, "c"]);
});

test("no more than `cap` engines run at once, and an agent that waited for a slot records its queue time", async () => {
  let t = 0;
  let running = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const engine: Engine = async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise<void>((r) => releases.push(r));
    running--;
    return { output: { result: "ok" } };
  };
  const { runtime, agents } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2, now: () => t });
  const all = runtime.parallel([1, 2, 3, 4, 5].map((i) => () => runtime.agent(`p${i}`, { label: `Worker (${i} of 5): p${i}` })));
  // Release engines one at a time, advancing the clock 10 ms each time.
  for (let done = 0; done < 5; done++) {
    while (releases.length === 0) await new Promise((r) => setImmediate(r));
    t += 10;
    releases.shift()!();
    await new Promise((r) => setImmediate(r));
  }
  await all;
  assert.equal(peak, 2);
  assert.deepEqual(
    agents.map((a) => a.queuedMs),
    [0, 0, 10, 20, 30],
  );
});

test("the cap holds across nested parallel() calls: never more than `cap` agents run at once", async () => {
  for (const cap of [1, 2, 3]) {
    let running = 0;
    let peak = 0;
    const engine: Engine = async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 2));
      running--;
      return { output: { result: "ok" } };
    };
    const { runtime, agents } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap });
    const fan = (k: string) => () => runtime.parallel([1, 2, 3].map((i) => () => runtime.agent(`${k}${i}`, { label: `Worker: ${k}${i}` })));
    const out = await runtime.parallel([fan("a"), fan("b"), fan("c")]);
    assert.equal(agents.length, 9);
    assert.equal(peak, cap, `cap ${cap}`);
    assert.equal(out.flat().filter((x) => x !== null).length, 9);
  }
});

test("roleOf reads the role from an agent label, chain-stage labels included, the same way the scorer does", () => {
  assert.equal(roleOf("Generator (1 of 2): Add parse_duration"), "generator");
  assert.equal(roleOf("Link 2 · Generator-evaluator, Evaluator (1 of 3): Add parse"), "evaluator");
  assert.equal(roleOf("Link 1 · Single, Worker: Plan"), "worker");
  assert.equal(roleOf("Grapher: logging current dispatch"), "scribe");
  assert.equal(roleOf("Debater pro (round 1 of 2)"), "debater");
  assert.equal(roleOf(undefined), "unlabelled");
});

test("a role forced to another model by the harness is requested on that model; every other role stays on the main model", async () => {
  const { engine, seen } = recordingEngine();
  const { runtime, agents } = createRuntime({ engine, mainModel: "claude-opus-5-5", cap: 2, roleModels: { evaluator: "claude-haiku-5-5" } });
  await runtime.agent("g", { label: "Generator (1 of 2): g" });
  await runtime.agent("e", { label: "Link 2 · Generator-evaluator, Evaluator (1 of 2): e" });
  await runtime.agent("s", { label: "Grapher: logging current dispatch" });
  assert.deepEqual(
    seen.map((r) => r.model),
    ["claude-opus-5-5", "claude-haiku-5-5", "claude-opus-5-5"],
  );
  assert.deepEqual(
    agents.map((a) => [a.role, a.model]),
    [
      ["generator", "claude-opus-5-5"],
      ["evaluator", "claude-haiku-5-5"],
      ["scribe", "claude-opus-5-5"],
    ],
  );
});

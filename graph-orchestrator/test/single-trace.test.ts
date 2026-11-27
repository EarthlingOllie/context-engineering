import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTrace } from "../src/trace/render.ts";
import { baseArgs, eventsOf, spec, wave } from "./helpers.ts";

// Ticket fixes/08 (COST-02(b)): a `single` dispatch's worker appends the
// dispatch's trace lines itself; the scribe runs only when it reports none.

const humans = [{ type: "human", trigger: "blocked", dispatch: "w1-d2", question: "Which DB?", answer: "postgres", mode: "attended" }];
const retry = () => spec({ id: "w2-d1", title: "Add the retry policy", topology: "single", dependsOn: ["w1-d2"] });
const appended = (n: number) => ({ result: "done", artifacts: [], blocked: false, traceAppended: n, traceTotalLines: 7 });

test("single: a worker that reports appended trace lines runs no scribe; the return says the worker wrote them", async () => {
  const { out, roles, calls } = await wave([retry()], { Worker: appended(2) }, { humans });
  assert.deepEqual(roles(), ["Worker"]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.deepEqual(r.scribe, { appended: 2, totalLines: 7 });
  assert.equal(r.tracedBy, "worker");
  const p = calls[0]!.prompt;
  assert.match(p, /to the file \/scratch\/t\/trace\/w2-d1\.jsonl/);
  assert.match(p, /traceAppended/);
  const schema = calls[0]!.opts.schema as { properties: Record<string, unknown>; required: string[] };
  assert.ok(schema.properties["traceAppended"], "the worker schema asks for the appended count");
  assert.ok(schema.required.includes("traceAppended"));
});

test("single: a worker that reports none appended runs the scribe, with the same lines the worker was given", async () => {
  const { out, roles, calls } = await wave([retry()], { Worker: appended(0) }, { humans });
  assert.deepEqual(roles(), ["Worker", "Grapher"]);
  assert.deepEqual(eventsOf(calls[1]!.prompt), eventsOf(calls[0]!.prompt));
  assert.equal(out.results[0]!.tracedBy, "scribe");
  assert.deepEqual(out.results[0]!.scribe, { appended: 2, totalLines: 99 });
});

test("single: a worker that omits the count counts as none, so the scribe runs", async () => {
  const { roles } = await wave([retry()], { Worker: { result: "done", artifacts: [], blocked: false } });
  assert.deepEqual(roles(), ["Worker", "Grapher"]);
});

test("single: the worker is given exactly the lines the scribe would write: humans stamped with now, then the done dispatch line", async () => {
  const { calls } = await wave([retry()], { Worker: appended(2) }, { humans });
  assert.deepEqual(eventsOf(calls[0]!.prompt), [
    { ...humans[0], at: baseArgs.now },
    { type: "dispatch", wave: 2, id: "w2-d1", title: "Add the retry policy", topology: "single", iterations: 1, status: "done", dependsOn: ["w1-d2"], agents: [{ role: "worker" }], demand: 1, concurrency: 1, at: baseArgs.now },
  ]);
});

test("single: a blocked worker appends nothing, so the scribe writes the blocked line", async () => {
  const { out, roles } = await wave([retry()], { Worker: { result: "", artifacts: [], blocked: true, question: "Which database?", traceAppended: 0 } });
  assert.deepEqual(roles(), ["Worker", "Grapher"]);
  const ev = out.events.find((e) => e.type === "dispatch") as { status: string; question?: string };
  assert.equal(ev.status, "blocked");
  assert.equal(ev.question, "Which database?");
});

test("single: a blocked worker that still reports appended lines is logged, and the scribe writes the true line", async () => {
  const { roles, logs } = await wave([retry()], { Worker: { result: "", artifacts: [], blocked: true, question: "Which database?", traceAppended: 1 } });
  assert.deepEqual(roles(), ["Worker", "Grapher"]);
  assert.ok(logs.some((l) => /w2-d1: worker appended 1 trace line\(s\) but the dispatch is blocked/.test(l)), logs.join(" | "));
});

test("other topologies keep the scribe; a chain's single stage is not asked to append the trace", async () => {
  const { roles, calls } = await wave(
    [spec({ id: "w1-d1", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "single", task: "b" }] } })],
    { Worker: appended(1) },
  );
  assert.equal(roles().at(-1), "Grapher");
  for (const c of calls.filter((c) => !/Grapher/.test(c.opts.label ?? ""))) assert.doesNotMatch(c.prompt, /<<<TRACE/);
});

test("the rendered diagram of a single dispatch is unchanged when the worker writes the trace", async () => {
  const byWorker = await wave([retry()], { Worker: appended(2) }, { humans });
  const byScribe = await wave([retry()], { Worker: appended(0) }, { humans });
  const workerLines = eventsOf(byWorker.calls[0]!.prompt).map((e) => JSON.stringify(e)).join("\n");
  const scribeLines = eventsOf(byScribe.calls.at(-1)!.prompt).map((e) => JSON.stringify(e)).join("\n");
  const diagram = renderTrace(workerLines);
  assert.equal(diagram, renderTrace(scribeLines));
  assert.ok(diagram.split("\n").map((l) => l.trim()).includes('w2_d1["Add the retry policy<br/>w2-d1 · single ×1"]:::done'), diagram);
});

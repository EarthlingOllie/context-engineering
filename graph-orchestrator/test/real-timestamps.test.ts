/**
 * Ticket observability-evals/04 (QUA-08): the trace's timeline is true.
 * A Workflow script cannot read the clock (ticket 02), so with no `now` the
 * dispatch entry point stamps placeholders, and whichever agent writes the
 * trace (the scribe, or the worker in `single`) replaces them with the
 * clock's UTC time before appending: the start from the launch's args file,
 * the end from the clock when it writes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { END_PLACEHOLDER, START_PLACEHOLDER } from "../src/clock.ts";
import { renderTrace } from "../src/trace/render.ts";
import { eventsOf, spec, wave } from "./helpers.ts";

const noNow = { now: undefined };
type Line = { type: string; at?: string; ended?: string };

test("dispatch seam: with no `now`, the dispatch line carries a start and an end placeholder, and undated interventions the start one", async () => {
  const { out } = await wave([spec({ id: "w2-d1", topology: "generator-evaluator", params: { pass_criteria: "x", max_iterations: 1 } })], { Evaluator: { pass: true, feedback: "", blocked: false } }, {
    ...noNow,
    humans: [{ trigger: "blocked", question: "Which DB?", answer: "postgres" }, { type: "hook", hook: "Stop" }],
  });
  const [human, hook, dispatch] = out.events as Line[];
  assert.equal(human!.at, START_PLACEHOLDER);
  assert.equal(hook!.at, START_PLACEHOLDER);
  assert.equal(dispatch!.type, "dispatch");
  assert.equal(dispatch!.at, START_PLACEHOLDER);
  assert.equal(dispatch!.ended, END_PLACEHOLDER);
});

test("dispatch seam: a `now` the orchestrator still supplies is the start; the end is always the writer's clock", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], {}, { now: "2026-11-27T09:15:00Z" });
  const d = out.events.find((e) => e.type === "dispatch") as Line;
  assert.equal(d.at, "2026-11-27T09:15:00Z");
  assert.equal(d.ended, END_PLACEHOLDER);
});

test("dispatch seam: an intervention's own time is kept", async () => {
  const { out } = await wave([spec({ id: "w2-d1", topology: "single" })], {}, { ...noNow, humans: [{ trigger: "blocked", at: "2026-11-27T08:00:00Z" }] });
  assert.equal((out.events[0] as Line).at, "2026-11-27T08:00:00Z");
});

test("dispatch seam: the scribe prompt says how to replace each placeholder from the clock, and to change nothing else", async () => {
  const { calls } = await wave([spec({ id: "w2-d1", topology: "fan-out", params: { branches: 1 } })], {}, noNow);
  const p = calls.at(-1)!.prompt;
  assert.match(p, /^ROLE: scribe/);
  assert.ok(p.includes(`date -u -r /scratch/t/args/w2-d1.json +%Y-%m-%dT%H:%M:%SZ`), "start: the launch's args file time, in UTC");
  assert.ok(p.includes(`date -u +%Y-%m-%dT%H:%M:%SZ`), "end: the clock now, in UTC");
  assert.ok(p.includes(START_PLACEHOLDER) && p.includes(END_PLACEHOLDER));
  assert.match(p, /If that file does not exist, use the end time for the start/);
  assert.ok(p.includes(`date -u -r "$(stat -f %m /scratch/t/args/w2-d1.json)" +%Y-%m-%dT%H:%M:%SZ`), "start: the BSD/macOS form, where -r takes epoch seconds");
  assert.match(p, /If neither command works, use the end time for the start/);
  assert.match(p, /Change nothing else/);
  assert.equal(eventsOf(p).filter((e) => (e as Line).ended === END_PLACEHOLDER).length, 1, "the lines themselves still carry the placeholder");
});

test("dispatch seam: a `single` worker's trace step says how to replace the placeholders too, and the scribe fallback gets the same lines", async () => {
  const { calls, roles } = await wave([spec({ id: "w2-d1", topology: "single" })], { Worker: { result: "done", artifacts: [], blocked: false, traceAppended: 0 } }, noNow);
  assert.deepEqual(roles(), ["Worker", "Grapher"]);
  const w = calls[0]!.prompt;
  assert.ok(w.includes(`date -u -r /scratch/t/args/w2-d1.json +%Y-%m-%dT%H:%M:%SZ`));
  assert.ok(w.includes(`date -u +%Y-%m-%dT%H:%M:%SZ`));
  assert.deepEqual(eventsOf(calls[1]!.prompt), eventsOf(w));
});

test("dispatch seam: the worker that appended its lines still runs no scribe when the lines carry placeholders", async () => {
  const { roles, out } = await wave([spec({ id: "w2-d1", topology: "single" })], { Worker: { result: "done", artifacts: [], blocked: false, traceAppended: 1, traceTotalLines: 1 } }, noNow);
  assert.deepEqual(roles(), ["Worker"]);
  assert.equal(out.results[0]!.tracedBy, "worker");
});

test("render: a placeholder left unreplaced is not drawn as a wave time", () => {
  const line = JSON.stringify({ type: "dispatch", wave: 1, id: "w1-d1", topology: "single", iterations: 1, status: "done", dependsOn: [], at: START_PLACEHOLDER, ended: END_PLACEHOLDER });
  const mmd = renderTrace(line);
  assert.ok(!mmd.includes("START_UTC"), mmd);
  assert.match(mmd, /Wave 1/);
});

test("render: a replaced start time is the wave's time", () => {
  const line = JSON.stringify({ type: "dispatch", wave: 1, id: "w1-d1", topology: "single", iterations: 1, status: "done", dependsOn: [], at: "2026-11-27T09:15:00Z", ended: "2026-11-27T09:20:00Z" });
  assert.match(renderTrace(line), /Wave 1 · 2026-11-27T09:15:00Z/);
});

const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../build.mjs", import.meta.url), "utf8");
const bundle = readFileSync(new URL("../workflows/dispatch.js", import.meta.url), "utf8");

test("docs seam: SKILL.md no longer says the orchestrator has no clock or passes `now`", () => {
  assert.doesNotMatch(skill, /no clock/i);
  assert.doesNotMatch(skill, /\bnow:\s*"/);
  assert.doesNotMatch(skill, /\{ now,/);
});

test("docs seam: the README launch args no longer carry `now`, and say who stamps the time", () => {
  assert.doesNotMatch(readme, /\{ now, scratch/);
  assert.doesNotMatch(readme, /orchestrator supplies `now`/);
  assert.match(readme, /clock's UTC time/);
});

test("docs seam: the dispatch skill's whenToUse (build.mjs and the built bundle) names the args without `now`", () => {
  for (const [name, text] of [["build.mjs", buildScript], ["workflows/dispatch.js", bundle]] as const) {
    assert.doesNotMatch(text, /\{ now,/, name);
    assert.ok(text.includes("with { scratch, dispatch, humans } as args"), name);
  }
});

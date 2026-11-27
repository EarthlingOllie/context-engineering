/**
 * Ticket B-07: refusals and idle time are visible without reading transcripts.
 * Seams: the dispatch (working and evaluator agents report how many writes were
 * refused and tools denied; the counts reach the dispatch line) and the docs
 * (SKILL.md's state file holds one `WAITING: <cause> since <time>` line).
 */
import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import type { TraceEvent } from "../src/types.ts";
import { runWorkflow } from "../src/run.ts";
import { baseArgs, fakeRuntime, spec, wave } from "./helpers.ts";

type DispatchLine = Extract<TraceEvent, { type: "dispatch" }>;
const topLine = (events: TraceEvent[]) => events.find((e): e is DispatchLine => e.type === "dispatch" && !e.parent);

test("dispatch line: refusal counts the generator and evaluator report are totalled on the line and kept per agent", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 2, pass_criteria: "1. tests pass" } })],
    {
      "Generator (1": { result: "r1", artifacts: [], blocked: false, writesRefused: 2, toolsDenied: 0 },
      "Generator (2": { result: "r2", artifacts: [], blocked: false, writesRefused: 1, toolsDenied: 1 },
      "Evaluator (1": { pass: false, feedback: "1. fix", blocked: false, writesRefused: 0, toolsDenied: 3 },
      "Evaluator (2": { pass: true, feedback: "", blocked: false, writesRefused: 0, toolsDenied: 0 },
    },
  );
  const line = topLine(out.events);
  assert.ok(line);
  assert.equal(line.writes_refused, 3);
  assert.equal(line.tools_denied, 4);
  assert.deepEqual(
    line.agents?.map((a) => [a.role, a.writes_refused, a.tools_denied]),
    [
      ["generator", 2, 0],
      ["evaluator", 0, 3],
      ["generator", 1, 1],
      ["evaluator", 0, 0],
    ],
  );
});

test("dispatch line: agents that report no counts leave the fields out rather than writing 0", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 1, pass_criteria: "x" } })], {});
  const line = topLine(out.events);
  assert.ok(line);
  assert.equal("writes_refused" in line, false);
  assert.equal("tools_denied" in line, false);
  for (const a of line.agents ?? []) assert.equal("writes_refused" in a || "tools_denied" in a, false);
});

test("dispatch line: fan-out workers' and the reducer's counts are totalled; a malformed count is ignored", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "fan-out", params: { split: ["a", "b"], reducer: true } })], {
    "Worker (1": { result: "a", artifacts: [], blocked: false, writesRefused: 1, toolsDenied: "lots" },
    "Worker (2": { result: "b", artifacts: [], blocked: false, writesRefused: 0, toolsDenied: 2 },
    Reducer: { result: "m", artifacts: [], blocked: false, writesRefused: -1, toolsDenied: 1 },
  });
  const line = topLine(out.events);
  assert.ok(line);
  assert.equal(line.writes_refused, 1);
  assert.equal(line.tools_denied, 3);
});

test("prompts: worker, generator, reducer and evaluator are asked for the counts in their structured output; judge and debater are not", async () => {
  const { calls } = await wave(
    [
      spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 1, pass_criteria: "x" } }),
      spec({ id: "w1-d2", topology: "fan-out", params: { split: ["a", "b"], reducer: true } }),
      spec({ id: "w1-d3", topology: "best-of-n", params: { n: 2, criteria: "smallest" } }),
    ],
    { Judge: { verdict: "[1]", reasoning: "r", artifacts: [], blocked: false } },
  );
  const asked = (c: (typeof calls)[number]) => {
    const props = (c.opts.schema as { properties?: Record<string, unknown>; required?: string[] } | undefined) ?? {};
    return !!props.properties?.["writesRefused"] && !!props.properties?.["toolsDenied"] && !!props.required?.includes("writesRefused") && !!props.required?.includes("toolsDenied") && /writesRefused/.test(c.prompt) && /toolsDenied/.test(c.prompt);
  };
  for (const role of ["Generator", "Evaluator", "Worker", "Reducer"]) {
    const c = calls.filter((x) => (x.opts.label ?? "").startsWith(role));
    assert.ok(c.length > 0, `${role} ran`);
    for (const x of c) assert.ok(asked(x), `${role} is asked for refusal counts`);
  }
  const judge = calls.find((x) => (x.opts.label ?? "").startsWith("Judge"))!;
  assert.equal(asked(judge), false);
});

test("single: the worker that writes its own line fills in its counts there, and no scribe runs", async () => {
  const f = fakeRuntime({ Worker: { result: "ok", artifacts: [], blocked: false, writesRefused: 1, toolsDenied: 2, traceAppended: 1, traceTotalLines: 1 } });
  const ret = await runWorkflow({ ...baseArgs, dispatch: spec({ id: "w1-d1", topology: "single" }) } as never, f.runtimeFor("w1-d1"));
  assert.equal(ret.tracedBy, "worker");
  assert.equal(f.calls.length, 1, "no scribe");
  const prompt = f.calls[0]!.prompt;
  const traced = /<<<TRACE\n([\s\S]*?)\nTRACE>>>/.exec(prompt)![1]!;
  assert.match(traced, /"writes_refused":"\{\{WRITES_REFUSED\}\}"/);
  assert.match(traced, /"tools_denied":"\{\{TOOLS_DENIED\}\}"/);
  assert.match(prompt, /\{\{WRITES_REFUSED\}\}.*writesRefused/);
  assert.match(prompt, /\{\{TOOLS_DENIED\}\}.*toolsDenied/);
  assert.ok(f.logs.some((l) => /1 write\(s\) refused, 2 tool\(s\) denied/.test(l)), "the counts are logged");
});

test("single: when the worker appends nothing, the scribe's line carries the worker's counts as numbers", async () => {
  const f = fakeRuntime({ Worker: { result: "ok", artifacts: [], blocked: false, writesRefused: 2, toolsDenied: 0, traceAppended: 0 } });
  await runWorkflow({ ...baseArgs, dispatch: spec({ id: "w1-d1", topology: "single" }) } as never, f.runtimeFor("w1-d1"));
  const scribe = f.calls.find((c) => (c.opts.label ?? "").startsWith("Grapher"))!;
  const line = /<<<TRACE\n([\s\S]*?)\nTRACE>>>/.exec(scribe.prompt)![1]!.split("\n").map((l) => JSON.parse(l) as TraceEvent).find((e): e is DispatchLine => e.type === "dispatch")!;
  assert.equal(line.writes_refused, 2);
  assert.equal(line.tools_denied, 0);
  assert.doesNotMatch(scribe.prompt, /WRITES_REFUSED/);
});

// ---------- docs seam ----------

const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");

test("SKILL.md: the state file template holds a WAITING line", () => {
  const template = skill.slice(skill.indexOf("## The state file"), skill.indexOf("## The loop"));
  assert.match(template, /^WAITING: +<cause> since <time>/m);
});

test("SKILL.md: one WAITING line while waiting on a human, CI or a restart, removed when the wait ends", () => {
  const rule = skill.split(/\n\n/).find((p) => p.includes("`WAITING: <cause> since <time>`"));
  assert.ok(rule, "a paragraph explains the WAITING line");
  assert.match(rule, /human/);
  assert.match(rule, /CI/);
  assert.match(rule, /restart/);
  assert.match(rule, /one /i);
  assert.match(rule, /remove/i);
  assert.match(rule, /UTC/);
});

// Finding B: a dispatch line carries the evaluator's verdict and first blocking reason, one line, capped,
// so an evaluator-only review shows why it kept a work item UNVERIFIED.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderTrace } from "../src/trace/render.ts";
import { VERDICT_MAX } from "../src/topologies/shared.ts";
import { spec, wave } from "./helpers.ts";

type Line = Record<string, unknown> & { type: string; id?: string };
const dispatchLine = (events: unknown[], id: string) => (events as Line[]).find((e) => e.type === "dispatch" && e.id === id)!;
const lines = (s: string) => s.split("\n").map((l) => l.trim());

const review = (over: Record<string, unknown> = {}) =>
  spec({
    id: "w4-d1",
    topology: "single",
    task: "Review T2's artifacts against its original pass criteria",
    roles: { evaluator: { instructions: "Check each criterion; report CANNOT RUN for a check you could not run" } },
    params: { pass_criteria: "P1 tests pass\nP5 runs under pypy3.10" },
    ...over,
  });

// ---------- dispatch seam: topologies with an evaluator loop ----------

test("a generator-evaluator line carries the last verdict with its first blocking reason", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 2, pass_criteria: "1. tests pass" } })], {
    Generator: { result: "attempt", artifacts: [], blocked: false },
    Evaluator: { pass: false, feedback: "1. test_reverse fails at t.py:9\n2. lint: unused var", blocked: false },
  });
  const d = dispatchLine(out.events, "w1-d1");
  assert.equal(d["status"], "exhausted");
  assert.equal(d["verdict"], "fail: 1. test_reverse fails at t.py:9");
});

test("a generator-evaluator that passed carries verdict pass, with no reason", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "x" } })], {
    Generator: { result: "attempt", artifacts: [], blocked: false },
    Evaluator: { pass: true, feedback: "", blocked: false },
  });
  assert.equal(dispatchLine(out.events, "w1-d1")["verdict"], "pass");
});

test("a blocked evaluator's verdict is blocked with its question's first line", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "x" } })], {
    Generator: { result: "attempt", artifacts: [], blocked: false },
    Evaluator: { pass: false, feedback: "", blocked: true, question: "P5 cannot run: pypy3.10 is not installed\nInstall it?" },
  });
  assert.equal(dispatchLine(out.events, "w1-d1")["verdict"], "blocked: P5 cannot run: pypy3.10 is not installed");
});

test("the verdict is one line, capped: a long first reason is cut to the cap and ends with an ellipsis", async () => {
  const long = `1. ${"x".repeat(400)}`;
  const { out } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 1, pass_criteria: "x" } })], {
    Generator: { result: "attempt", artifacts: [], blocked: false },
    Evaluator: { pass: false, feedback: `${long}\n2. more`, blocked: false },
  });
  const v = String(dispatchLine(out.events, "w1-d1")["verdict"]);
  assert.equal(VERDICT_MAX, 160);
  assert.equal(v.length, VERDICT_MAX);
  assert.ok(v.startsWith("fail: 1. xxx"));
  assert.ok(v.endsWith("…"));
  assert.ok(!v.includes("\n"));
});

test("no evaluator ran, no verdict: a plain single's line has no verdict field", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: { result: "done", artifacts: [], blocked: false } });
  assert.equal("verdict" in dispatchLine(out.events, "w1-d1"), false);
});

// ---------- dispatch seam: relay and panel, whose evaluators also run ----------

const relayOk = { done_criteria: "all features pass", progress: "/scratch/progress.md" };

test("an exhausted relay's line carries the last check's verdict and first blocking reason", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "relay", params: { ...relayOk, max_sessions: 2 } })], {
    "Worker (1": { result: "one", artifacts: [], blocked: false },
    "Worker (2": { result: "two", artifacts: [], blocked: false },
    "Evaluator (1": { pass: false, feedback: "first gap", blocked: false },
    "Evaluator (2": { pass: false, feedback: "1. feature 3 still failing\n2. another", blocked: false },
  });
  const d = dispatchLine(out.events, "w1-d1");
  assert.equal(d["status"], "exhausted");
  assert.equal(d["verdict"], "fail: 1. feature 3 still failing");
});

test("a relay whose done-check passed carries verdict pass", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "relay", params: { ...relayOk, max_sessions: 3 } })], {
    "Worker (1": { result: "one", artifacts: [], blocked: false },
    "Evaluator (1": { pass: true, feedback: "", blocked: false },
  });
  assert.equal(dispatchLine(out.events, "w1-d1")["verdict"], "pass");
});

test("a relay whose evaluator blocked carries verdict blocked with the question's first line", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "relay", params: { ...relayOk, max_sessions: 2 } })], {
    "Worker (1": { result: "one", artifacts: [], blocked: false },
    "Evaluator (1": { pass: false, feedback: "", blocked: true, question: "Which feature list is current?\nmore" },
  });
  assert.equal(dispatchLine(out.events, "w1-d1")["verdict"], "blocked: Which feature list is current?");
});

const panelSpec = (params: Record<string, unknown> = {}) =>
  spec({
    id: "w1-d1",
    topology: "panel",
    params: { lenses: [{ name: "correctness", focus: "bugs" }, { name: "caps", focus: "limits" }], pass_criteria: "no defects", ...params },
  });

test("a failing panel's line carries its pooled verdict and the first failing lens's first feedback line", async () => {
  const { out } = await wave([panelSpec()], {
    "Evaluator correctness": { pass: true, feedback: "", blocked: false },
    "Evaluator caps": { pass: false, feedback: "1. MAX_WIDTH unchecked at fan-out.ts:20\n2. second", blocked: false },
  });
  assert.equal(dispatchLine(out.events, "w1-d1")["verdict"], "fail: lens caps: 1. MAX_WIDTH unchecked at fan-out.ts:20");
});

test("a passing panel carries verdict pass", async () => {
  const { out } = await wave([panelSpec()], {
    "Evaluator correctness": { pass: true, feedback: "", blocked: false },
    "Evaluator caps": { pass: true, feedback: "", blocked: false },
  });
  assert.equal(dispatchLine(out.events, "w1-d1")["verdict"], "pass");
});

test("a blocked panel carries verdict blocked with the blocking lens's question", async () => {
  const { out } = await wave([panelSpec()], {
    "Evaluator correctness": { pass: true, feedback: "", blocked: false },
    "Evaluator caps": { pass: false, feedback: "", blocked: true, question: "which cap table is current?" },
  });
  assert.equal(dispatchLine(out.events, "w1-d1")["verdict"], "blocked: lens caps: which cap table is current?");
});

// ---------- dispatch seam: the evaluator-only review ----------

test("evaluator-only review: a single with roles.evaluator runs one evaluator, and a failing review's line says why it kept the label", async () => {
  const { out, roles, calls } = await wave([review()], {
    Evaluator: { pass: false, feedback: "1. P5 CANNOT RUN: pypy3.10 absent from the image\n2. P1-P4 PASS", blocked: false },
  });
  assert.deepEqual(roles().filter((r) => r !== "Grapher"), ["Evaluator"]);
  const prompt = calls.find((c) => c.opts.label?.startsWith("Evaluator"))!.prompt;
  assert.ok(prompt.startsWith("ROLE: evaluator"));
  assert.ok(prompt.includes("P5 runs under pypy3.10"), "the review's pass criteria reach the evaluator");
  assert.ok(!prompt.includes("<<<TRACE"), "the evaluator does not write its own trace line: its verdict is not known in advance");
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "FAIL\n1. P5 CANNOT RUN: pypy3.10 absent from the image\n2. P1-P4 PASS");
  assert.equal(r.tracedBy, "scribe");
  const d = dispatchLine(out.events, "w4-d1");
  assert.equal(d["status"], "done");
  assert.equal(d["verdict"], "fail: 1. P5 CANNOT RUN: pypy3.10 absent from the image");
  assert.equal(d["criteria"], "P1 tests pass\nP5 runs under pypy3.10");
  assert.deepEqual(d["agents"], [{ role: "evaluator" }]);
});

test("evaluator-only review: a passing review returns PASS and its line carries verdict pass", async () => {
  const { out } = await wave([review()], { Evaluator: { pass: true, feedback: "", blocked: false } });
  assert.equal(out.results[0]!.status, "done");
  assert.equal(out.results[0]!.result, "PASS");
  assert.equal(dispatchLine(out.events, "w4-d1")["verdict"], "pass");
});

test("evaluator-only review: a blocked evaluator blocks the dispatch with its question, and the verdict says so", async () => {
  const { out } = await wave([review()], { Evaluator: { pass: false, feedback: "", blocked: true, question: "P5 needs pypy3.10; may I install it?" } });
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.question, "P5 needs pypy3.10; may I install it?");
  const d = dispatchLine(out.events, "w4-d1");
  assert.equal(d["verdict"], "blocked: P5 needs pypy3.10; may I install it?");
  assert.equal(d["question"], "P5 needs pypy3.10; may I install it?");
});

test("evaluator-only review without params.pass_criteria: the task carries the criteria, and no criteria field is invented", async () => {
  const { out, calls } = await wave([review({ params: {}, task: "Review T2 against: P1 tests pass; P5 runs under pypy3.10" })], {
    Evaluator: { pass: true, feedback: "", blocked: false },
  });
  const prompt = calls.find((c) => c.opts.label?.startsWith("Evaluator"))!.prompt;
  assert.ok(prompt.includes("PASS CRITERIA"));
  assert.ok(prompt.includes("TASK: Review T2 against: P1 tests pass; P5 runs under pypy3.10"));
  assert.equal("criteria" in dispatchLine(out.events, "w4-d1"), false);
});

test("a single with both roles.worker and roles.evaluator stays a worker single", async () => {
  const { roles } = await wave([review({ roles: { worker: { instructions: "do it" }, evaluator: { instructions: "unused" } } })], {
    Worker: { result: "done", artifacts: [], blocked: false, traceAppended: 1, traceTotalLines: 1 },
  });
  assert.deepEqual(roles().filter((r) => r !== "Grapher" && r !== "Checker"), ["Worker"]);
});

// ---------- render seam ----------

const line = (over: Record<string, unknown>) => JSON.stringify({ type: "dispatch", wave: 4, id: "w4-d1", topology: "single", iterations: 1, status: "done", dependsOn: [], ...over });

test("render: a dispatch with a verdict shows it as the node's last line, shortened and escaped", () => {
  const out = renderTrace(line({ title: "Review T2", verdict: 'fail: 1. P5 CANNOT RUN: pypy3.10 absent from the image "<x>" and more words here' }));
  const node = lines(out).find((l) => l.startsWith("w4_d1["))!;
  assert.ok(node.startsWith('w4_d1["Review T2<br/>w4-d1 · single ×1<br/>fail: 1. P5 CANNOT RUN: pypy3.10 absent from the'), node);
  assert.ok(node.endsWith('…"]:::done'), node);
  assert.ok(!node.includes("<x>"));
});

test("render: a passing verdict shows as pass; a line without a verdict renders exactly as before", () => {
  const withPass = lines(renderTrace(line({ verdict: "pass" })));
  assert.ok(withPass.includes('w4_d1["w4-d1<br/>single ×1<br/>pass"]:::done'));
  const without = lines(renderTrace(line({})));
  assert.ok(without.includes('w4_d1["w4-d1<br/>single ×1"]:::done'));
});

test("render: a non-string verdict is ignored, not drawn", () => {
  const L = lines(renderTrace(line({ verdict: { evil: true } })));
  assert.ok(L.includes('w4_d1["w4-d1<br/>single ×1"]:::done'));
});

// ---------- the docs the orchestrator plans from ----------

const doc = (p: string) => readFileSync(new URL(`../skills/graph-orchestrator/${p}`, import.meta.url), "utf8");

test("SKILL.md: the evaluator-only dispatch is a single with roles.evaluator and the original pass_criteria, and its line's verdict says why it kept the label", () => {
  const skill = doc("SKILL.md");
  assert.match(skill, /a `single` with `roles\.evaluator` \(no `roles\.worker`\) and the original criteria as `params\.pass_criteria`/);
  assert.match(skill, /its trace line's `verdict`/);
});

test("catalog.md: single documents the evaluator-only review, its PASS/FAIL result and the verdict field", () => {
  const catalog = doc("catalog.md");
  const from = catalog.indexOf("\n## single\n");
  assert.ok(from !== -1);
  const single = catalog.slice(from, catalog.indexOf("\n## ", from + 1));
  assert.match(single, /\*\*Evaluator-only review\.\*\*/);
  assert.match(single, /`pass_criteria`/);
  assert.match(single, /`verdict`/);
});

test("catalog.md: the verdict paragraph names exactly which topologies carry `verdict` and which do not", () => {
  const catalog = doc("catalog.md");
  const para = catalog.split("\n").find((l) => l.startsWith("**Evaluator-only review.**"))!;
  for (const t of ["generator-evaluator", "iterative-fan-out", "relay", "panel"]) assert.ok(para.includes(t), t);
  assert.match(para, /best-of-n and debate run a judge, not an evaluator, and carry no `verdict`/);
  assert.match(para, /`fail: lens <name>: <first feedback line>`/);
});

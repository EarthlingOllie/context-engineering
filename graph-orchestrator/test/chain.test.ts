/**
 * Chain stage lines, not-run list and panel gate (ticket A-05, REL-04).
 * Seams: the dispatch (a chain's returned result, status and stages, run
 * through the wave on a fake runtime) and the document (catalog.md's chain
 * section).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spec, wave } from "./helpers.ts";

const single = (task: string, title?: string) => ({ topology: "single", task, ...(title ? { title } : {}) });

test("dispatch: a done chain's result has one line per stage, then the last stage's lines", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "chain", returns: { shape: "stage lines then result", maxLines: 8 }, params: { stages: [single("plan"), single("build"), single("ship")] } })],
    {
      "Link 1 · Single, Worker": { result: "/s/plan.txt\n4 rules", artifacts: [], blocked: false },
      "Link 2 · Single, Worker": { result: "built 2 files\nall green", artifacts: [], blocked: false },
      "Link 3 · Single, Worker": { result: "/s/note.txt\nthree lines\nsent", artifacts: [], blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, ["w1-d1-s1 done: /s/plan.txt", "w1-d1-s2 done: built 2 files", "w1-d1-s3 done: /s/note.txt", "/s/note.txt", "three lines", "sent"].join("\n"));
});

test("dispatch: a done chain's result is cut to the line limit", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "chain", returns: { shape: "x", maxLines: 3 }, params: { stages: [single("a"), single("b")] } })],
    { Worker: { result: "l1\nl2\nl3", artifacts: [], blocked: false } },
  );
  assert.equal(out.results[0]!.result, ["w1-d1-s1 done: l1", "w1-d1-s2 done: l1", "l1"].join("\n"));
});

test("dispatch: a chain whose stage 1 is exhausted lists the later stages under `not run:`", async () => {
  const { out, roles } = await wave(
    [
      spec({
        id: "w1-d1",
        topology: "chain",
        returns: { shape: "x", maxLines: 6 },
        params: {
          stages: [
            { topology: "generator-evaluator", task: "write it", params: { max_iterations: 1, pass_criteria: "1. tests pass" } },
            single("review", "Review the change"),
            { id: "w1-x3", ...single("announce") },
          ],
        },
      }),
    ],
    {
      Generator: { result: "wrote it", artifacts: [], blocked: false },
      Evaluator: { pass: false, feedback: "1. tests fail: 2 failing", blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "exhausted");
  assert.deepEqual(r.stages, ["w1-d1-s1:exhausted"]);
  assert.ok(!roles().includes("Worker"), "no later stage runs");
  const lines = r.result.split("\n");
  assert.match(lines[0]!, /^w1-d1-s1 exhausted: /);
  assert.equal(lines.at(-1), 'not run: w1-d1-s2 "Review the change", w1-x3');
  assert.ok(lines.length <= 6);
});

test("dispatch: the `not run:` line survives the cut", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "chain", returns: { shape: "x", maxLines: 2 }, params: { stages: [single("a"), single("b")] } })],
    { "Link 1 · Single, Worker": { result: "", artifacts: [], blocked: true, question: "Which region?" } },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.question, "Which region?");
  assert.equal(r.result, "w1-d1-s1 blocked: \nnot run: w1-d1-s2");
});

const panelStage = (over: Record<string, unknown> = {}) => ({
  title: "Review the plan",
  topology: "panel",
  task: "review the plan",
  params: { lenses: [{ name: "correctness", focus: "plan vs spec" }, { name: "scope", focus: "nothing extra" }], pass_criteria: "1. every rule has a test" },
  ...over,
});

test("dispatch: a mid-chain panel FAIL stops the chain as `exhausted`, naming the panel", async () => {
  const { out, roles } = await wave(
    [spec({ id: "w1-d1", topology: "chain", returns: { shape: "x", maxLines: 8 }, params: { stages: [single("plan"), panelStage(), single("build")] } })],
    {
      "Link 1 · Single, Worker": { result: "/s/plan.txt", artifacts: [], blocked: false },
      "Evaluator correctness": { pass: false, feedback: "rule 3 has no test", blocked: false },
      "Link 3 · Single, Worker": { result: "built", artifacts: [], blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "exhausted");
  assert.deepEqual(r.stages, ["w1-d1-s1:done", "w1-d1-s2:exhausted"]);
  assert.equal(r.iterations, 2);
  assert.equal(roles().filter((x) => x === "Worker").length, 1, "the stage after the panel does not run");
  const lines = r.result.split("\n");
  assert.equal(lines[0], "w1-d1-s1 done: /s/plan.txt");
  assert.equal(lines[1], 'w1-d1-s2 exhausted: panel w1-d1-s2 "Review the plan" returned FAIL (1/2)');
  assert.ok(lines.includes("[correctness] FAIL: rule 3 has no test"));
  assert.equal(lines.at(-1), "not run: w1-d1-s3");
  const chainEv = out.events.find((e) => e.type === "dispatch" && e.id === "w1-d1") as { status?: string; stages?: string[] };
  assert.equal(chainEv.status, "exhausted");
  assert.deepEqual(chainEv.stages, ["w1-d1-s1:done", "w1-d1-s2:exhausted"]);
});

test("dispatch: with `gate: false` a mid-chain panel FAIL does not stop the chain", async () => {
  const { out, calls } = await wave(
    [spec({ id: "w1-d1", topology: "chain", returns: { shape: "x", maxLines: 8 }, params: { stages: [single("plan"), panelStage({ gate: false }), single("build")] } })],
    {
      "Evaluator correctness": { pass: false, feedback: "rule 3 has no test", blocked: false },
      "Link 3 · Single, Worker": { result: "built", artifacts: [], blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.deepEqual(r.stages, ["w1-d1-s1:done", "w1-d1-s2:done", "w1-d1-s3:done"]);
  assert.match(r.result, /^w1-d1-s2 done: FAIL \(1\/2\)$/m);
  assert.match(calls.at(-2)!.prompt, /w1-d1-s2 \(done\) returned: FAIL \(1\/2\)/, "the next stage sees the panel's verdict");
});

test("dispatch: a panel PASS mid-chain, or a FAIL from the last stage, does not trip the gate", async () => {
  const { out } = await wave(
    [
      spec({ id: "w1-d1", topology: "chain", params: { stages: [panelStage(), single("build")] } }),
      spec({ id: "w1-d2", topology: "chain", params: { stages: [single("build"), panelStage()] } }),
    ],
    { "w1-d2 Link 2 · Panel, Evaluator correctness": { pass: false, feedback: "bad", blocked: false } },
  );
  assert.equal(out.results[0]!.status, "done");
  assert.deepEqual(out.results[0]!.stages, ["w1-d1-s1:done", "w1-d1-s2:done"]);
  assert.equal(out.results[1]!.status, "done");
  assert.match(out.results[1]!.result, /^w1-d2-s2 done: FAIL \(1\/2\)$/m);
});

test("document: the catalog's chain section describes the stage lines, `not run:`, the panel gate and its opt-out", () => {
  const catalog = readFileSync(new URL("../skills/graph-orchestrator/catalog.md", import.meta.url), "utf8");
  const section = catalog.slice(catalog.indexOf("## chain"), catalog.indexOf("\n## ", catalog.indexOf("## chain") + 1));
  assert.match(section, /`<stage id> <status>: <first line>`/);
  assert.match(section, /`not run: /);
  assert.match(section, /panel[^\n]*`FAIL`[^\n]*`exhausted`/);
  assert.match(section, /`gate: false`/);
});

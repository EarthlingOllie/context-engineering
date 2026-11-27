/**
 * Subagents wait without loops (ticket A-14, SPD-03).
 * Seam: the dispatch. Generator and worker prompts carry the wait sentence;
 * evaluator and judge prompts do not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spec, wave } from "./helpers.ts";

const WAIT =
  "To wait on a long command, run it in the foreground with a timeout, or start it in the background and wait once on its exit status; never loop on `pgrep -f`, which matches itself.";

test("dispatch: generator prompt carries the wait sentence, evaluator prompt does not", async () => {
  const { calls } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 1, pass_criteria: "1. npm test exits 0" } })],
    { Generator: { result: "done", artifacts: [], blocked: false } },
  );
  const gen = calls.find((c) => (c.opts.label ?? "").startsWith("Generator"))!;
  const ev = calls.find((c) => (c.opts.label ?? "").startsWith("Evaluator"))!;
  assert.ok(gen.prompt.includes(WAIT), "generator prompt carries the wait sentence");
  assert.ok(!ev.prompt.includes(WAIT), "evaluator prompt does not");
});

test("dispatch: a single worker's prompt carries the wait sentence", async () => {
  const { calls } = await wave(
    [spec({ id: "w1-d1", topology: "single", params: {} })],
    { Worker: { result: "fine", artifacts: [], blocked: false } },
  );
  const worker = calls.find((c) => (c.opts.label ?? "").startsWith("Worker"))!;
  assert.ok(worker.prompt.includes(WAIT), "worker prompt carries the wait sentence");
});

test("dispatch: fan-out workers carry the wait sentence, a best-of-n judge does not", async () => {
  const { calls } = await wave(
    [spec({ id: "w1-d1", topology: "best-of-n", params: { n: 2, criteria: "smallest diff" } })],
    {
      Worker: { result: "candidate", artifacts: [], blocked: false },
      Judge: { verdict: "[1]", reasoning: "smaller", artifacts: [], blocked: false },
    },
  );
  const workers = calls.filter((c) => (c.opts.label ?? "").startsWith("Worker"));
  const judge = calls.find((c) => (c.opts.label ?? "").startsWith("Judge"))!;
  assert.equal(workers.length, 2);
  for (const w of workers) assert.ok(w.prompt.includes(WAIT));
  assert.ok(!judge.prompt.includes(WAIT));
});

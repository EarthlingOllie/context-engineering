/**
 * The canned engine behind `main.ts --stub`: no model call. Its evaluator
 * passes by default; `evaluator: "fail"` makes every evaluator fail, so the
 * dry run reaches `exhausted` the way samples 5 and 9 must.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHarness } from "./harness.ts";
import { stubEngine } from "./stub-engine.ts";

const bundleSource = readFileSync(new URL("../../workflows/dispatch.js", import.meta.url), "utf8");
const sampleArgs = (file: string, scratch: string) => {
  const args = (JSON.parse(readFileSync(new URL(`../samples/${file}`, import.meta.url), "utf8")) as { args: Record<string, unknown> }).args;
  return { ...args, scratch };
};

test("with a passing evaluator the stub finishes sample 3 in one round, and its scribe writes the trace file", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "stub-"));
  const result = await runHarness({ bundleSource, args: sampleArgs("03-generator-evaluator-python.json", scratch), engine: stubEngine(), mainModel: "m", cap: 2 });
  assert.equal(result.return?.["status"], "done");
  assert.equal(result.return?.["iterations"], 1);
  assert.ok(readFileSync(join(scratch, "trace", "w1-d3.jsonl"), "utf8").includes('"status":"done"'));
});

test("with a failing evaluator the stub ends sample 5 exhausted after its 2 rounds and sample 9 at stage 2", async () => {
  const s5 = await runHarness({ bundleSource, args: sampleArgs("05-generator-evaluator-exhausted.json", mkdtempSync(join(tmpdir(), "stub-"))), engine: stubEngine({ evaluator: "fail" }), mainModel: "m", cap: 2 });
  assert.equal(s5.return?.["status"], "exhausted");
  assert.equal(s5.return?.["iterations"], 2);
  const s9 = await runHarness({ bundleSource, args: sampleArgs("09-chain-stage-2-fails.json", mkdtempSync(join(tmpdir(), "stub-"))), engine: stubEngine({ evaluator: "fail" }), mainModel: "m", cap: 2 });
  assert.deepEqual(s9.return?.["stages"], ["w1-d9-s1:done", "w1-d9-s2:exhausted"]);
});

test("the stub reports each call as served on the model requested, or with `serveModel` on that model whatever was requested", async () => {
  const args = sampleArgs("03-generator-evaluator-python.json", mkdtempSync(join(tmpdir(), "stub-")));
  const honest = await runHarness({ bundleSource, args, engine: stubEngine(), mainModel: "claude-opus-5-5", cap: 2, roleModels: { evaluator: "claude-haiku-5-5" } });
  assert.deepEqual(
    honest.agents.map((a) => [a.role, a.model, (a.engine as { calls: Array<{ model: string }> }).calls.map((c) => c.model)]),
    [
      ["generator", "claude-opus-5-5", ["claude-opus-5-5"]],
      ["evaluator", "claude-haiku-5-5", ["claude-haiku-5-5"]],
      ["scribe", "claude-haiku-5-5", ["claude-haiku-5-5"]],
    ],
  );
  const args2 = sampleArgs("03-generator-evaluator-python.json", mkdtempSync(join(tmpdir(), "stub-")));
  const fallback = await runHarness({ bundleSource, args: args2, engine: stubEngine({ serveModel: "claude-opus-5-5" }), mainModel: "claude-opus-5-5", cap: 2, roleModels: { evaluator: "claude-haiku-5-5" } });
  const ev = fallback.agents.find((a) => a.role === "evaluator")!;
  assert.equal(ev.model, "claude-haiku-5-5");
  assert.deepEqual((ev.engine as { calls: Array<{ model: string }> }).calls.map((c) => c.model), ["claude-opus-5-5"]);
});

test("the stub relay worker rewrites the progress file every session, which the harness sees through `watch`", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "stub-"));
  const args = sampleArgs("14-relay-python-features.json", scratch) as unknown as { dispatch: { params: Record<string, unknown> } };
  const progress = join(scratch, "progress.md");
  args.dispatch.params["progress"] = progress;
  const r = await runHarness({ bundleSource, args, engine: stubEngine({ evaluator: "fail" }), mainModel: "m", cap: 2, watch: [progress] });
  assert.equal(r.return?.["status"], "exhausted");
  assert.equal(r.return?.["iterations"], 3);
  const workers = r.agents.filter((a) => a.role === "worker");
  assert.equal(workers.length, 3);
  for (const w of workers) assert.notEqual(w.watched![progress]!.after, w.watched![progress]!.before);
  assert.equal(readFileSync(progress, "utf8"), "SESSION 1: stub\nSESSION 2: stub\nSESSION 3: stub\n");
});

test("the stub judge picks candidate 1 (sample 12) and the stub debate reaches a verdict after every round (sample 13)", async () => {
  const s12 = await runHarness({ bundleSource, args: sampleArgs("12-best-of-n-python-bug.json", mkdtempSync(join(tmpdir(), "stub-"))), engine: stubEngine(), mainModel: "m", cap: 2 });
  assert.equal(s12.return?.["status"], "done");
  const judge = s12.agents.find((a) => a.role === "judge")!;
  assert.equal((judge.output as { chosen: number }).chosen, 1);
  const s13 = await runHarness({ bundleSource, args: sampleArgs("13-debate-design.json", mkdtempSync(join(tmpdir(), "stub-"))), engine: stubEngine(), mainModel: "m", cap: 2 });
  assert.equal(s13.return?.["status"], "done");
  assert.equal(s13.return?.["iterations"], 2);
  assert.deepEqual(s13.agents.map((a) => a.role), ["debater", "debater", "debater", "debater", "judge", "scribe"]);
});

test("with a failing evaluator the stub iterative fan-out (sample 10) runs its second round and ends exhausted", async () => {
  const r = await runHarness({ bundleSource, args: sampleArgs("10-iterative-fan-out-docs-gap.json", mkdtempSync(join(tmpdir(), "stub-"))), engine: stubEngine({ evaluator: "fail" }), mainModel: "m", cap: 2 });
  assert.equal(r.return?.["status"], "exhausted");
  assert.equal(r.return?.["iterations"], 2);
  assert.ok(r.agents.some((a) => /round 2 of 2/.test(a.label ?? "")));
});

test("sample 17: the stub worker claims the artifact its instructions name without writing it; the stub checker finds it missing, so the dispatch comes back blocked", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "stub-"));
  const result = await runHarness({ bundleSource, args: sampleArgs("17-single-phantom-artifact.json", scratch), engine: stubEngine(), mainModel: "m", cap: 2 });
  assert.equal(result.return?.["status"], "blocked");
  assert.equal(result.return?.["question"], "artifact /work/scratch/phantom-summary.md claimed but not found");
  assert.deepEqual(result.return?.["missing"], ["/work/scratch/phantom-summary.md"]);
  assert.deepEqual(result.agents.map((a) => a.label?.split(":")[0]), ["Worker", "Checker", "Grapher"]);
  const line = JSON.parse(readFileSync(join(scratch, "trace", "w1-d17.jsonl"), "utf8").trim().split("\n").at(-1)!);
  assert.equal(line.status, "blocked");
  assert.deepEqual(line.missing, ["/work/scratch/phantom-summary.md"]);
});

test("the stub checker really looks: a claimed path that exists is not missing", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "stub-"));
  const engine = stubEngine();
  const out = await engine({ prompt: `ROLE: checker\nCheck whether each of the 2 path(s) below exists\n- ${scratch}\n- ${join(scratch, "nope.md")}\nReturn in \`missing\` every path`, label: "Checker: artifacts exist", model: "m" } as never);
  assert.deepEqual((out.output as { missing: string[] }).missing, [join(scratch, "nope.md")]);
});

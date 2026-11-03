// relay: the topology's own tests (design-specs.md, relay).
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentDemand } from "../src/topologies.ts";
import { spec, wave, type Call, roleOf } from "./helpers.ts";

const ok = { done_criteria: "all features pass", progress: "/scratch/progress.md" };
const fail = (feedback: string) => ({ pass: false, feedback, blocked: false });
const pass = { pass: true, feedback: "", blocked: false };

test("relay done: sessions run until the done-check passes; result is the last session's, artifacts are the union", async () => {
  const { out, roles, calls } = await wave([spec({ id: "w1-d1", topology: "relay", params: { ...ok, max_sessions: 5 } })], {
    "Worker (1": { result: "feature 1 done", artifacts: ["/a.ts", "/progress.md"], blocked: false },
    "Worker (2": { result: "feature 2 done\nall green", artifacts: ["/b.ts", "/progress.md"], blocked: false },
    "Evaluator (1": fail("1. feature 2 still failing\n2. progress not updated"),
    "Evaluator (2": pass,
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 2);
  assert.equal(r.result, "feature 2 done\nall green");
  assert.deepEqual(r.artifacts, ["/a.ts", "/progress.md", "/b.ts"]);
  assert.deepEqual(roles(), ["Worker (1 of 5)", "Evaluator (1 of 5)", "Worker (2 of 5)", "Evaluator (2 of 5)", "Trace scribe"]);

  const w1 = calls[0]!.prompt;
  assert.match(w1, /SESSION 1 of 5/);
  assert.match(w1, /read PROGRESS first/);
  assert.match(w1, /PROGRESS: \/scratch\/progress\.md/);
  assert.match(w1, /all features pass/);
  assert.doesNotMatch(w1, /LAST CHECK FEEDBACK/);

  const w2 = calls[2]!.prompt;
  assert.match(w2, /SESSION 2 of 5/);
  assert.match(w2, /LAST CHECK FEEDBACK[\s\S]*feature 2 still failing/);
  assert.match(w2, /ARTIFACTS SO FAR[\s\S]*\/a\.ts/);
  assert.doesNotMatch(w2, /feature 1 done/, "no prior inline result carries over");

  const e1 = calls[1]!.prompt;
  assert.match(e1, /DONE CRITERIA[\s\S]*all features pass/);
  assert.match(e1, /SUBMISSION[\s\S]*feature 1 done[\s\S]*\/a\.ts[\s\S]*\/scratch\/progress\.md/);
});

test("relay exhausted: every check fails; result keeps the last session's lines and ends with the first feedback line", async () => {
  const { out, roles } = await wave(
    [spec({ id: "w1-d1", topology: "relay", params: { ...ok, max_sessions: 2 }, returns: { shape: "s", maxLines: 2 } })],
    {
      "Worker (1": { result: "one", artifacts: ["/a"], blocked: false },
      "Worker (2": { result: "two\nthree", artifacts: ["/b"], blocked: false },
      "Evaluator (1": fail("first gap"),
      "Evaluator (2": fail("1. last gap\n2. another"),
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "exhausted");
  assert.equal(r.iterations, 2);
  assert.equal(r.result, "two\n-- exhausted after 2 session(s); last check: 1. last gap");
  assert.deepEqual(r.artifacts, ["/a", "/b"]);
  assert.equal(roles().filter((l) => /^Worker \(\d/.test(l)).length, 2);
});

test("relay check_every: the evaluator runs every k sessions and always after the last", async () => {
  const { out, roles } = await wave([spec({ id: "w1-d1", topology: "relay", params: { ...ok, max_sessions: 5, check_every: 2 } })], {
    Evaluator: fail("not yet"),
  });
  assert.equal(out.results[0]!.status, "exhausted");
  assert.deepEqual(roles(), [
    "Worker (1 of 5)",
    "Worker (2 of 5)",
    "Evaluator (1 of 3)",
    "Worker (3 of 5)",
    "Worker (4 of 5)",
    "Evaluator (2 of 3)",
    "Worker (5 of 5)",
    "Evaluator (3 of 3)",
    "Trace scribe",
  ]);
});

test("relay blocked: a blocked worker or a blocked evaluator returns blocked with its question", async () => {
  const worker = await wave([spec({ id: "w1-d1", topology: "relay", params: ok })], {
    "Worker (2": { result: "half", artifacts: ["/x"], blocked: true, question: "which database?" },
    Evaluator: fail("keep going"),
  });
  const rw = worker.out.results[0]!;
  assert.equal(rw.status, "blocked");
  assert.equal(rw.question, "which database?");
  assert.equal(rw.iterations, 2);
  assert.equal(worker.roles().filter((l) => l.includes("Evaluator")).length, 1, "no check after a blocked session");

  const ev = await wave([spec({ id: "w1-d1", topology: "relay", params: ok })], {
    "Evaluator (1": { pass: false, feedback: "", blocked: true, question: "is the spec final?" },
  });
  const re = ev.out.results[0]!;
  assert.equal(re.status, "blocked");
  assert.equal(re.question, "is the spec final?");
  assert.equal(ev.roles().filter((l) => /^Worker \(\d/.test(l)).length, 1);
});

test("relay failed: a worker or evaluator returning nothing fails, keeping the artifacts so far", async () => {
  const w = await wave([spec({ id: "w1-d1", topology: "relay", params: ok })], {
    "Worker (1": { result: "one", artifacts: ["/a"], blocked: false },
    "Worker (2": null,
    Evaluator: fail("more"),
  });
  const rw = w.out.results[0]!;
  assert.equal(rw.status, "failed");
  assert.match(rw.result, /worker returned nothing in session 2/);
  assert.deepEqual(rw.artifacts, ["/a"]);

  const e = await wave([spec({ id: "w1-d1", topology: "relay", params: ok })], {
    "Worker (1": { result: "one", artifacts: ["/a"], blocked: false },
    "Evaluator (1": null,
  });
  const re = e.out.results[0]!;
  assert.equal(re.status, "failed");
  assert.match(re.result, /evaluator returned nothing in session 1/);
  assert.deepEqual(re.artifacts, ["/a"]);
});

test("relay params: cap breach is over_budget, missing done_criteria or progress is failed, and none spends an agent", async () => {
  const { out, roles } = await wave([
    spec({ id: "w1-d1", topology: "relay", params: { ...ok, max_sessions: 11 } }),
    spec({ id: "w1-d2", topology: "relay", params: { progress: "/scratch/p.md" } }),
    spec({ id: "w1-d3", topology: "relay", params: { done_criteria: "x" } }),
    spec({ id: "w1-d4", topology: "relay", params: { ...ok, check_every: 0 } }),
  ]);
  assert.deepEqual(roles().filter((l) => l !== "Trace scribe"), [], "no role agent runs");
  assert.deepEqual(out.results.map((r) => r.status), ["over_budget", "failed", "failed", "failed"]);
  assert.match(out.results[0]!.result, /cap of 10/);
  assert.match(out.results[1]!.result, /done_criteria/);
  assert.match(out.results[2]!.result, /progress/);
});

test("relay cap: max_sessions 10, the cap itself, runs all 10 sessions and 10 checks (worst case 20 agents)", async () => {
  const { out, roles } = await wave([spec({ id: "w1-d1", topology: "relay", params: { ...ok, max_sessions: 10 } })], { Evaluator: (c: Call) => fail(`no ${c.n}`) });
  assert.equal(out.results[0]!.status, "exhausted");
  assert.equal(out.results[0]!.iterations, 10);
  assert.equal(roles().filter((l) => /^Worker \(\d/.test(l)).length, 10);
  assert.equal(roles().filter((l) => l.includes("Evaluator")).length, 10);
});

test("relay demand: max_sessions + ceil(max_sessions / check_every); 0 on a cap breach", () => {
  assert.equal(agentDemand(spec({ id: "x", topology: "relay", params: ok })), 6);
  assert.equal(agentDemand(spec({ id: "x", topology: "relay", params: { ...ok, max_sessions: 6, check_every: 4 } })), 8);
  assert.equal(agentDemand(spec({ id: "x", topology: "relay", params: { ...ok, max_sessions: 5, check_every: 2 } })), 8);
  assert.equal(agentDemand(spec({ id: "x", topology: "relay", params: { ...ok, max_sessions: 10 } })), 20);
  assert.equal(agentDemand(spec({ id: "x", topology: "relay", params: { ...ok, max_sessions: 11 } })), 0);
});

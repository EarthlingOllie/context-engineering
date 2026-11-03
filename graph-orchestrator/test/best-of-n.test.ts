// best-of-n: the topology's own tests (design-specs.md, best-of-n).
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentDemand } from "../src/topologies.ts";
import { spec, wave } from "./helpers.ts";

const bon = (params: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  spec({ id: "w1-d1", topology: "best-of-n", params: { criteria: "smallest diff", ...params }, ...over });

const work = (result: string, artifacts: string[] = []) => ({ result, artifacts, blocked: false });

test("best-of-n select: n workers in parallel, then a judge that sees every candidate; winner's artifacts first", async () => {
  const { out, calls, labels } = await wave(
    [bon({ variants: ["minimal change", "restructure"] }, { roles: { worker: { instructions: "write a patch" }, judge: { instructions: "pick the smallest" } } })],
    {
      "Attempt 1 of 2": work("patch A", ["/a.diff"]),
      "Attempt 2 of 2": work("patch B", ["/b.diff"]),
      Judge: { verdict: "candidate 2: /b.diff", reasoning: "smaller", chosen: 2, artifacts: ["/verdict.md"], blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 1);
  assert.match(r.result, /^candidate 2: \/b\.diff/);
  assert.deepEqual(r.artifacts, ["/b.diff", "/a.diff", "/verdict.md"]);
  assert.deepEqual(labels().filter((l) => !l.includes("scribe")), ["Attempt 1 of 2", "Attempt 2 of 2", "Judge"]);

  const a1 = calls.find((c) => c.opts.label === "Attempt 1 of 2")!.prompt;
  assert.match(a1, /ROLE: worker/);
  assert.match(a1, /ATTEMPT 1 of 2/);
  assert.match(a1, /APPROACH:\nminimal change/);
  assert.match(a1, /CRITERIA:\nsmallest diff/);
  assert.match(a1, /w1-d1-c1\//);
  assert.match(a1, /do not modify the working tree/);
  assert.match(a1, /write a patch/);

  const j = calls.find((c) => c.opts.label === "Judge")!.prompt;
  assert.match(j, /ROLE: judge/);
  assert.match(j, /CRITERIA:\nsmallest diff/);
  assert.match(j, /CANDIDATES:\n\[1\] patch A\nartifacts: \/a\.diff\n\n\[2\] patch B\nartifacts: \/b\.diff/);
  assert.match(j, /pick the smallest/);
  assert.match(j, /chosen/);
});

test("best-of-n: without variants there is no APPROACH section, and n defaults to 3", async () => {
  const { calls, labels } = await wave([bon({})]);
  assert.deepEqual(labels().filter((l) => l.includes("Attempt")), ["Attempt 1 of 3", "Attempt 2 of 3", "Attempt 3 of 3"]);
  assert.doesNotMatch(calls.find((c) => c.opts.label === "Attempt 2 of 3")!.prompt, /APPROACH/);
});

test("best-of-n vote: a strict majority of normalised first lines wins with no judge", async () => {
  const { out, labels } = await wave([bon({ n: 3, mode: "vote" })], {
    "Attempt 1 of 3": work("  Option   B\nbecause x", ["/1.md"]),
    "Attempt 2 of 3": work("option a", ["/2.md"]),
    "Attempt 3 of 3": work("option b\nbecause y", ["/3.md"]),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "  Option   B\nbecause x");
  assert.deepEqual(r.artifacts, ["/1.md", "/2.md", "/3.md"]);
  assert.equal(labels().filter((l) => l.includes("Judge")).length, 0);
});

test("best-of-n vote: a tie falls through to the judge", async () => {
  const { out, labels } = await wave([bon({ n: 4, mode: "vote" })], {
    "Attempt 1 of 4": work("A", ["/1"]),
    "Attempt 2 of 4": work("B", ["/2"]),
    "Attempt 3 of 4": work("a", ["/3"]),
    "Attempt 4 of 4": work("b", ["/4"]),
    Judge: { verdict: "B wins", reasoning: "r", chosen: 4, artifacts: [], blocked: false },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "B wins");
  assert.deepEqual(r.artifacts, ["/4", "/1", "/2", "/3"]);
  assert.deepEqual(labels().filter((l) => l.includes("Judge")), ["Judge"]);
});

test("best-of-n vote: a majority counts against n, so a plurality among survivors still goes to the judge", async () => {
  const { labels } = await wave([bon({ n: 3, mode: "vote" })], {
    "Attempt 1 of 3": work("A"),
    "Attempt 2 of 3": { result: "", artifacts: [], blocked: true, question: "which db?" },
    "Attempt 3 of 3": work("B"),
    Judge: { verdict: "A", reasoning: "r", chosen: 1, artifacts: [], blocked: false },
  });
  assert.deepEqual(labels().filter((l) => l.includes("Judge")), ["Judge"]);
});

test("best-of-n: blocked and empty attempts drop out; the judge sees them as notes and the questions travel", async () => {
  const { out, calls, logs } = await wave([bon({ n: 3 })], {
    "Attempt 1 of 3": { result: "", artifacts: [], blocked: true, question: "which db?" },
    "Attempt 2 of 3": null,
    "Attempt 3 of 3": work("patch C", ["/c.diff"]),
    Judge: { verdict: "C", reasoning: "only one", chosen: 3, artifacts: [], blocked: false },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "C");
  assert.deepEqual(r.artifacts, ["/c.diff"]);
  assert.match(r.question ?? "", /attempt 1: which db\?/);
  const j = calls.find((c) => c.opts.label === "Judge")!.prompt;
  assert.match(j, /CANDIDATES:\n\[3\] patch C/);
  assert.doesNotMatch(j, /\[1\] /);
  assert.match(j, /BLOCKED ATTEMPTS:\n.*attempt 1 blocked: which db\?\n.*attempt 2 returned nothing/);
  assert.ok(logs.some((l) => /attempt 2\/3 returned nothing/.test(l)));
});

test("best-of-n: every attempt dropped out -> blocked if any blocked (with questions), else failed; no judge", async () => {
  const blocked = await wave([bon({ n: 2 })], {
    "Attempt 1 of 2": { result: "", artifacts: [], blocked: true, question: "q1" },
    "Attempt 2 of 2": null,
  });
  assert.equal(blocked.out.results[0]!.status, "blocked");
  assert.match(blocked.out.results[0]!.question ?? "", /attempt 1: q1/);
  assert.equal(blocked.labels().filter((l) => l.includes("Judge")).length, 0);

  const failed = await wave([bon({ n: 2 })], { "Attempt 1 of 2": null, "Attempt 2 of 2": null });
  assert.equal(failed.out.results[0]!.status, "failed");
  assert.equal(failed.labels().filter((l) => l.includes("Judge")).length, 0);
});

test("best-of-n: a blocked judge blocks the dispatch; a judge returning nothing fails it; candidate artifacts kept", async () => {
  const b = await wave([bon({ n: 2 })], {
    "Attempt 1 of 2": work("A", ["/a"]),
    "Attempt 2 of 2": work("B", ["/b"]),
    Judge: { verdict: "", reasoning: "", artifacts: [], blocked: true, question: "which matters more?" },
  });
  assert.equal(b.out.results[0]!.status, "blocked");
  assert.equal(b.out.results[0]!.question, "which matters more?");
  assert.deepEqual(b.out.results[0]!.artifacts, ["/a", "/b"]);

  const f = await wave([bon({ n: 2 })], { "Attempt 1 of 2": work("A", ["/a"]), "Attempt 2 of 2": work("B", ["/b"]), Judge: null });
  assert.equal(f.out.results[0]!.status, "failed");
  assert.deepEqual(f.out.results[0]!.artifacts, ["/a", "/b"]);
});

test("best-of-n: an invalid `chosen` falls back to the [i] in the verdict, else candidate order", async () => {
  const { out } = await wave([bon({ n: 2 })], {
    "Attempt 1 of 2": work("A", ["/a"]),
    "Attempt 2 of 2": work("B", ["/b"]),
    Judge: { verdict: "pick [2]", reasoning: "r", chosen: 7, artifacts: [], blocked: false },
  });
  assert.deepEqual(out.results[0]!.artifacts, ["/b", "/a"]); // falls back to the [i] in the verdict
  const none = await wave([bon({ n: 2 })], {
    "Attempt 1 of 2": work("A", ["/a"]),
    "Attempt 2 of 2": work("B", ["/b"]),
    Judge: { verdict: "neither stands out", reasoning: "r", artifacts: [], blocked: false },
  });
  assert.deepEqual(none.out.results[0]!.artifacts, ["/a", "/b"]);
});

test("best-of-n param check: caps -> over_budget, malformed -> failed, no agent spent", async () => {
  const { out, labels } = await wave([
    spec({ id: "w1-d1", topology: "best-of-n", params: { criteria: "c", n: 10 } }),
    spec({ id: "w1-d2", topology: "best-of-n", params: { criteria: "c", variants: Array.from({ length: 10 }, (_, i) => `v${i}`) } }),
    spec({ id: "w1-d3", topology: "best-of-n", params: { criteria: "c", n: 2, variants: ["a", "b", "c"] } }),
    spec({ id: "w1-d4", topology: "best-of-n", params: { criteria: "c", n: 1 } }),
    spec({ id: "w1-d5", topology: "best-of-n", params: { n: 2 } }),
    spec({ id: "w1-d6", topology: "best-of-n", params: { criteria: "c", mode: "synthesize" } }),
    spec({ id: "w1-d7", topology: "best-of-n", params: { criteria: "c", variants: ["a", ""] } }),
  ]);
  assert.deepEqual(labels().filter((l) => l !== "Trace scribe"), [], "no role agent runs");
  assert.deepEqual(out.results.map((r) => r.status), ["over_budget", "over_budget", "failed", "failed", "failed", "failed", "failed"]);
  assert.match(out.results[0]!.result, /width cap of 9/);
  assert.match(out.results[2]!.result, /disagrees/);
  assert.match(out.results[3]!.result, /at least 2/);
  assert.match(out.results[4]!.result, /criteria/);
  assert.match(out.results[5]!.result, /mode/);
  assert.match(out.results[6]!.result, /variants/);
});

test("best-of-n demand: n + 1 in both modes, variants set n, 0 above the cap", () => {
  const d = (params: Record<string, unknown>) => agentDemand(spec({ id: "x", topology: "best-of-n", params: { criteria: "c", ...params } }));
  assert.equal(d({}), 4);
  assert.equal(d({ n: 5 }), 6);
  assert.equal(d({ variants: ["a", "b"], mode: "vote" }), 3);
  assert.equal(d({ n: 9, mode: "vote" }), 10);
  assert.equal(d({ n: 10 }), 0);
});

test("best-of-n vote: empty first lines are no votes and cannot win without the judge", async () => {
  const { out, labels } = await wave([bon({ n: 3, mode: "vote" })], {
    Attempt: work(""),
    Judge: { verdict: "[1] none useful", reasoning: "r", chosen: 1, artifacts: [], blocked: false },
  });
  assert.deepEqual(labels().filter((l) => l.includes("Judge")), ["Judge"]);
  assert.equal(out.results[0]!.result, "[1] none useful");
});

test("best-of-n: a judge with an empty verdict -> failed, candidate artifacts kept", async () => {
  const { out } = await wave([bon({ n: 2 })], {
    Attempt: work("patch", ["/p.diff"]),
    Judge: { verdict: "  ", reasoning: "", chosen: 1, artifacts: [], blocked: false },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "failed");
  assert.match(r.result, /judge returned nothing/);
  assert.deepEqual(r.artifacts, ["/p.diff"]);
});

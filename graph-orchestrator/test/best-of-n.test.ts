// best-of-n: the topology's own tests (design-specs.md, best-of-n).
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentDemand } from "../src/topologies.ts";
import { roleOf, spec, wave } from "./helpers.ts";

const bon = (params: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  spec({ id: "w1-d1", topology: "best-of-n", params: { criteria: "smallest diff", ...params }, ...over });

const work = (result: string, artifacts: string[] = []) => ({ result, artifacts, blocked: false });

test("best-of-n select: n workers in parallel, then a judge that sees every candidate; winner's artifacts first", async () => {
  const { out, calls, labels, roles } = await wave(
    [bon({ variants: ["minimal change", "restructure"] }, { roles: { worker: { instructions: "write a patch" }, judge: { instructions: "pick the smallest" } } })],
    {
      "Worker (1 of 2)": work("patch A", ["/a.diff"]),
      "Worker (2 of 2)": work("patch B", ["/b.diff"]),
      Judge: { verdict: "candidate 2: /b.diff", reasoning: "smaller", chosen: 2, artifacts: ["/verdict.md"], blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 1);
  assert.match(r.result, /^candidate 2: \/b\.diff/);
  assert.deepEqual(r.artifacts, ["/b.diff", "/a.diff", "/verdict.md"]);
  assert.deepEqual(roles().filter((l) => !l.includes("Grapher")), ["Worker (1 of 2)", "Worker (2 of 2)", "Judge"]);
  assert.deepEqual(labels(), ["Worker (1 of 2): do w1-d1", "Worker (2 of 2): do w1-d1", "Judge: do w1-d1", "Grapher: logging current dispatch"]);

  const a1 = calls.find((c) => roleOf(c.opts.label) === "Worker (1 of 2)")!.prompt;
  assert.match(a1, /ROLE: worker/);
  assert.match(a1, /ATTEMPT 1 of 2/);
  assert.match(a1, /APPROACH:\nminimal change/);
  assert.match(a1, /CRITERIA:\nsmallest diff/);
  assert.match(a1, /w1-d1-c1\//);
  assert.match(a1, /do not modify the working tree/);
  assert.match(a1, /write a patch/);

  const j = calls.find((c) => roleOf(c.opts.label) === "Judge")!.prompt;
  assert.match(j, /ROLE: judge/);
  assert.match(j, /CRITERIA:\nsmallest diff/);
  assert.match(j, /CANDIDATES:\n\[1\] patch A\nartifacts: \/a\.diff\n\n\[2\] patch B\nartifacts: \/b\.diff/);
  assert.match(j, /pick the smallest/);
  assert.match(j, /chosen/);
});

test("best-of-n: without variants there is no APPROACH section, and n defaults to 3", async () => {
  const { calls, roles } = await wave([bon({})]);
  assert.deepEqual(roles().filter((l) => l.includes("Worker")), ["Worker (1 of 3)", "Worker (2 of 3)", "Worker (3 of 3)"]);
  assert.doesNotMatch(calls.find((c) => roleOf(c.opts.label) === "Worker (2 of 3)")!.prompt, /APPROACH/);
});

test("best-of-n vote: a strict majority of normalised first lines wins with no judge", async () => {
  const { out, roles } = await wave([bon({ n: 3, mode: "vote" })], {
    "Worker (1 of 3)": work("  Option   B\nbecause x", ["/1.md"]),
    "Worker (2 of 3)": work("option a", ["/2.md"]),
    "Worker (3 of 3)": work("option b\nbecause y", ["/3.md"]),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "  Option   B\nbecause x");
  assert.deepEqual(r.artifacts, ["/1.md", "/2.md", "/3.md"]);
  assert.equal(roles().filter((l) => l.includes("Judge")).length, 0);
});

test("best-of-n vote: a tie falls through to the judge", async () => {
  const { out, roles } = await wave([bon({ n: 4, mode: "vote" })], {
    "Worker (1 of 4)": work("A", ["/1"]),
    "Worker (2 of 4)": work("B", ["/2"]),
    "Worker (3 of 4)": work("a", ["/3"]),
    "Worker (4 of 4)": work("b", ["/4"]),
    Judge: { verdict: "B wins", reasoning: "r", chosen: 4, artifacts: [], blocked: false },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "B wins");
  assert.deepEqual(r.artifacts, ["/4", "/1", "/2", "/3"]);
  assert.deepEqual(roles().filter((l) => l.includes("Judge")), ["Judge"]);
});

test("best-of-n vote: a majority counts against n, so a plurality among survivors still goes to the judge", async () => {
  const { roles } = await wave([bon({ n: 3, mode: "vote" })], {
    "Worker (1 of 3)": work("A"),
    "Worker (2 of 3)": { result: "", artifacts: [], blocked: true, question: "which db?" },
    "Worker (3 of 3)": work("B"),
    Judge: { verdict: "A", reasoning: "r", chosen: 1, artifacts: [], blocked: false },
  });
  assert.deepEqual(roles().filter((l) => l.includes("Judge")), ["Judge"]);
});

test("best-of-n: blocked and empty attempts drop out; the judge sees them as notes and the questions travel", async () => {
  const { out, calls, logs } = await wave([bon({ n: 3 })], {
    "Worker (1 of 3)": { result: "", artifacts: [], blocked: true, question: "which db?" },
    "Worker (2 of 3)": null,
    "Worker (3 of 3)": work("patch C", ["/c.diff"]),
    Judge: { verdict: "C", reasoning: "only one", chosen: 3, artifacts: [], blocked: false },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "C");
  assert.deepEqual(r.artifacts, ["/c.diff"]);
  assert.match(r.question ?? "", /attempt 1: which db\?/);
  const j = calls.find((c) => roleOf(c.opts.label) === "Judge")!.prompt;
  assert.match(j, /CANDIDATES:\n\[3\] patch C/);
  assert.doesNotMatch(j, /\[1\] /);
  assert.match(j, /BLOCKED ATTEMPTS:\n.*attempt 1 blocked: which db\?\n.*attempt 2 returned nothing/);
  assert.ok(logs.some((l) => /attempt 2\/3 returned nothing/.test(l)));
});

test("best-of-n: every attempt dropped out -> blocked if any blocked (with questions), else failed; no judge", async () => {
  const blocked = await wave([bon({ n: 2 })], {
    "Worker (1 of 2)": { result: "", artifacts: [], blocked: true, question: "q1" },
    "Worker (2 of 2)": null,
  });
  assert.equal(blocked.out.results[0]!.status, "blocked");
  assert.match(blocked.out.results[0]!.question ?? "", /attempt 1: q1/);
  assert.equal(blocked.roles().filter((l) => l.includes("Judge")).length, 0);

  const failed = await wave([bon({ n: 2 })], { "Worker (1 of 2)": null, "Worker (2 of 2)": null });
  assert.equal(failed.out.results[0]!.status, "failed");
  assert.equal(failed.roles().filter((l) => l.includes("Judge")).length, 0);
});

test("best-of-n: a blocked judge blocks the dispatch; a judge returning nothing fails it; candidate artifacts kept", async () => {
  const b = await wave([bon({ n: 2 })], {
    "Worker (1 of 2)": work("A", ["/a"]),
    "Worker (2 of 2)": work("B", ["/b"]),
    Judge: { verdict: "", reasoning: "", artifacts: [], blocked: true, question: "which matters more?" },
  });
  assert.equal(b.out.results[0]!.status, "blocked");
  assert.equal(b.out.results[0]!.question, "which matters more?");
  assert.deepEqual(b.out.results[0]!.artifacts, ["/a", "/b"]);

  const f = await wave([bon({ n: 2 })], { "Worker (1 of 2)": work("A", ["/a"]), "Worker (2 of 2)": work("B", ["/b"]), Judge: null });
  assert.equal(f.out.results[0]!.status, "failed");
  assert.deepEqual(f.out.results[0]!.artifacts, ["/a", "/b"]);
});

test("best-of-n: an invalid `chosen` falls back to the [i] in the verdict, else candidate order", async () => {
  const { out } = await wave([bon({ n: 2 })], {
    "Worker (1 of 2)": work("A", ["/a"]),
    "Worker (2 of 2)": work("B", ["/b"]),
    Judge: { verdict: "pick [2]", reasoning: "r", chosen: 7, artifacts: [], blocked: false },
  });
  assert.deepEqual(out.results[0]!.artifacts, ["/b", "/a"]); // falls back to the [i] in the verdict
  const none = await wave([bon({ n: 2 })], {
    "Worker (1 of 2)": work("A", ["/a"]),
    "Worker (2 of 2)": work("B", ["/b"]),
    Judge: { verdict: "neither stands out", reasoning: "r", artifacts: [], blocked: false },
  });
  assert.deepEqual(none.out.results[0]!.artifacts, ["/a", "/b"]);
});

test("best-of-n param check: caps -> over_budget, malformed -> failed, no agent spent", async () => {
  const { out, roles } = await wave([
    spec({ id: "w1-d1", topology: "best-of-n", params: { criteria: "c", n: 10 } }),
    spec({ id: "w1-d2", topology: "best-of-n", params: { criteria: "c", variants: Array.from({ length: 10 }, (_, i) => `v${i}`) } }),
    spec({ id: "w1-d3", topology: "best-of-n", params: { criteria: "c", n: 2, variants: ["a", "b", "c"] } }),
    spec({ id: "w1-d4", topology: "best-of-n", params: { criteria: "c", n: 1 } }),
    spec({ id: "w1-d5", topology: "best-of-n", params: { n: 2 } }),
    spec({ id: "w1-d6", topology: "best-of-n", params: { criteria: "c", mode: "synthesize" } }),
    spec({ id: "w1-d7", topology: "best-of-n", params: { criteria: "c", variants: ["a", ""] } }),
  ]);
  assert.deepEqual(roles().filter((l) => l !== "Grapher"), [], "no role agent runs");
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
  const { out, roles } = await wave([bon({ n: 3, mode: "vote" })], {
    Worker: work(""),
    Judge: { verdict: "[1] none useful", reasoning: "r", chosen: 1, artifacts: [], blocked: false },
  });
  assert.deepEqual(roles().filter((l) => l.includes("Judge")), ["Judge"]);
  assert.equal(out.results[0]!.result, "[1] none useful");
});

test("best-of-n: a judge with an empty verdict -> failed, candidate artifacts kept", async () => {
  const { out } = await wave([bon({ n: 2 })], {
    Worker: work("patch", ["/p.diff"]),
    Judge: { verdict: "  ", reasoning: "", chosen: 1, artifacts: [], blocked: false },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "failed");
  assert.match(r.result, /judge returned nothing/);
  assert.deepEqual(r.artifacts, ["/p.diff"]);
});

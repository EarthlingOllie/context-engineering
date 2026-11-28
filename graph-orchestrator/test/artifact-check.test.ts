import { test } from "node:test";
import assert from "node:assert/strict";
import { spec, wave } from "./helpers.ts";

// Fixes finding A (by-hand session 2026-11-27, w4-d2): a dispatch listed an artifact path it never wrote, and
// nothing caught it until the acceptance dispatch. After any dispatch returns, the engine checks each local
// artifact path in its result exists; a missing one is marked in the result and on the trace line, and a done
// result becomes blocked with the question `artifact <path> claimed but not found`.

const claims = (...artifacts: string[]) => ({ result: "wrote it", artifacts, blocked: false });
const missing = (...paths: string[]) => ({ missing: paths });
const dispatchLine = (events: Array<Record<string, unknown>>) => events.find((e) => e["type"] === "dispatch" && !e["parent"])!;

test("artifact check: a done dispatch whose claimed artifact is missing comes back blocked with the question", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("/scratch/t/a.md", "/scratch/t/b.md"), Checker: missing("/scratch/t/b.md") });
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.question, "artifact /scratch/t/b.md claimed but not found");
  assert.deepEqual(r.missing, ["/scratch/t/b.md"]);
  assert.deepEqual(r.artifacts, ["/scratch/t/a.md", "/scratch/t/b.md"], "the claim stays in the result, marked by `missing`");
});

test("artifact check: the trace line carries the missing paths and the downgraded status", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("/scratch/t/b.md"), Checker: missing("/scratch/t/b.md") });
  const line = dispatchLine(out.events as never);
  assert.equal(line["status"], "blocked");
  assert.deepEqual(line["missing"], ["/scratch/t/b.md"]);
  assert.equal(line["question"], "artifact /scratch/t/b.md claimed but not found");
});

test("artifact check: several missing paths each get their own clause in the question", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("x.md", "y.md"), Checker: missing("x.md", "y.md") });
  assert.equal(out.results[0]!.question, "artifact x.md claimed but not found; artifact y.md claimed but not found");
});

test("artifact check: every artifact found leaves a done result as it was, with no `missing` field", async () => {
  const { out, calls } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("/scratch/t/a.md"), Checker: missing() });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.question, undefined);
  assert.equal("missing" in r, false);
  assert.equal("missing" in dispatchLine(out.events as never), false);
  const checker = calls.find((c) => /^Checker/.test(c.opts.label ?? ""))!;
  assert.match(checker.prompt, /^ROLE: checker/);
  assert.match(checker.prompt, /\/scratch\/t\/a\.md/);
});

test("artifact check: it runs after every topology, not only single", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "1. it exists" } })],
    { Generator: claims("/scratch/t/gen.ts"), Checker: missing("/scratch/t/gen.ts") },
  );
  assert.equal(out.results[0]!.status, "blocked");
  assert.deepEqual(out.results[0]!.missing, ["/scratch/t/gen.ts"]);
});

test("artifact check: no local artifact means no checker agent", async () => {
  const { roles } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("https://example.com/pr/1", "  ") });
  assert.deepEqual(roles(), ["Worker", "Grapher"]);
});

test("artifact check: only local paths are asked about, each once; URLs are not checked", async () => {
  const { calls } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("a.md", "https://claude.ai/artifact/x", "a.md", "/s/b.md"), Checker: missing() });
  const checker = calls.find((c) => /^Checker/.test(c.opts.label ?? ""))!;
  const asked = checker.prompt.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  assert.deepEqual(asked, ["a.md", "/s/b.md"]);
});

test("artifact check: a path the checker names but was not asked about is ignored", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("a.md"), Checker: missing("/etc/passwd") });
  assert.equal(out.results[0]!.status, "done");
  assert.equal("missing" in out.results[0]!, false);
});

test("artifact check: a blocked, exhausted or failed result keeps its status and question but is still marked", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "single" })],
    { Worker: { result: "", artifacts: ["a.md"], blocked: true, question: "Which DB?" }, Checker: missing("a.md") },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.question, "Which DB?");
  assert.deepEqual(r.missing, ["a.md"]);
});

test("artifact check: a checker that returns nothing or throws leaves the result unchanged, and says so in the log", async () => {
  for (const Checker of [null, () => { throw new Error("boom"); }]) {
    const { out, logs } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("a.md"), Checker });
    assert.equal(out.results[0]!.status, "done");
    assert.ok(logs.some((l) => /w1-d1: artifact check did not run/.test(l)), logs.join(" | "));
  }
});

test("artifact check: each missing path is logged, and the STATUS line shows the downgrade", async () => {
  const { logs } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("a.md"), Checker: missing("a.md") });
  assert.ok(logs.includes("w1-d1: artifact a.md claimed but not found"), logs.join(" | "));
  assert.equal(logs.at(-1), "STATUS blocked");
});

test("artifact check: the checker runs on Haiku by default and the spec can override it", async () => {
  const run = async (roles: Record<string, unknown>) => {
    const { calls } = await wave([spec({ id: "w1-d1", topology: "single", roles: roles as never })], { Worker: claims("a.md"), Checker: missing() });
    return calls.find((c) => /^Checker/.test(c.opts.label ?? ""))!.opts.model;
  };
  assert.equal(await run({}), "haiku");
  assert.equal(await run({ checker: { instructions: "", model: "sonnet" } }), "sonnet");
});

test("artifact check: the checker is not one of the dispatch's agents on its trace line", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: claims("a.md"), Checker: missing() });
  const agents = dispatchLine(out.events as never)["agents"] as Array<{ role: string }>;
  assert.deepEqual(agents.map((a) => a.role), ["worker"]);
});

test("artifact check: a single whose worker wrote its done line gets the blocked line from the scribe", async () => {
  const { out, roles } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: { ...claims("a.md"), traceAppended: 1 }, Checker: missing("a.md") });
  assert.deepEqual(roles(), ["Worker", "Checker", "Grapher"]);
  assert.equal(out.results[0]!.tracedBy, "scribe");
  assert.equal(dispatchLine(out.events as never)["status"], "blocked");
});

test("artifact check: the diagram draws the scribe's later blocked line, not the worker's earlier done line, for the same dispatch", async () => {
  const { renderTrace } = await import("../src/trace/render.ts");
  const line = (status: string, extra: Record<string, unknown> = {}) => JSON.stringify({ type: "dispatch", wave: 1, id: "w1-d1", topology: "single", iterations: 1, status, dependsOn: [], at: "2026-10-30T10:00:00Z", ...extra });
  const out = renderTrace([line("done"), line("blocked", { question: "artifact a.md claimed but not found" })].join("\n"));
  const nodes = out.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("w1_d1["));
  assert.equal(nodes.length, 1, out);
  assert.match(nodes[0]!, /:::blocked$/);
  assert.match(out, /Wave 1 · 2026-10-30T10:00:00Z · 1 blocked"/);
});

test("artifact check: SKILL.md's Integrate table tells the orchestrator what a blocked result with `missing` means", async () => {
  const { readFileSync } = await import("node:fs");
  const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");
  const integrate = skill.slice(skill.indexOf("### Integrate"), skill.indexOf("### Rolling launches"));
  const blockedRow = integrate.split("\n").find((l) => l.startsWith("| `blocked` |")) ?? "";
  assert.match(blockedRow, /artifact <path> claimed but not found/);
  assert.match(blockedRow, /`missing`/);
  assert.match(blockedRow, /re-dispatch/i);
  const doneRow = integrate.split("\n").find((l) => l.startsWith("| `done` |")) ?? "";
  assert.match(doneRow, /artifact check/);
});

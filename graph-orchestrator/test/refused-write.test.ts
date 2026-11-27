/**
 * Refused-write fallback and report naming (ticket A-06, QUA-05).
 * Seams: the dispatch (generator, worker and reducer prompts carry the
 * fallback sentence; evaluator, judge and debater prompts do not) and the
 * documents (SKILL.md and the catalog examples name report artifacts
 * `.txt`, `.json` or `.html`, never `.md`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spec, wave } from "./helpers.ts";

const FALLBACK =
  "If a write is refused, put the full content in the result and make line 1 `ARTIFACT REFUSED: <path>`.";

test("dispatch: generator and evaluator prompts — only the generator carries the refused-write fallback", async () => {
  const { calls } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 1, pass_criteria: "1. npm test exits 0" } })],
    { Generator: { result: "done", artifacts: [], blocked: false } },
  );
  const gen = calls.find((c) => (c.opts.label ?? "").startsWith("Generator"))!;
  const ev = calls.find((c) => (c.opts.label ?? "").startsWith("Evaluator"))!;
  assert.ok(gen.prompt.includes(FALLBACK), "generator prompt carries the fallback");
  assert.ok(!ev.prompt.includes(FALLBACK), "evaluator prompt does not");
});

test("dispatch: worker and reducer prompts in a fan-out carry the refused-write fallback", async () => {
  const { calls } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", params: { split: ["a", "b"], reducer: true } })],
    {
      Worker: { result: "fine", artifacts: [], blocked: false },
      Reducer: { result: "merged", artifacts: [], blocked: false },
    },
  );
  const workers = calls.filter((c) => (c.opts.label ?? "").startsWith("Worker"));
  const reducer = calls.find((c) => (c.opts.label ?? "").startsWith("Reducer"))!;
  assert.equal(workers.length, 2);
  for (const w of workers) assert.ok(w.prompt.includes(FALLBACK), "worker prompt carries the fallback");
  assert.ok(reducer.prompt.includes(FALLBACK), "reducer prompt carries the fallback");
});

test("dispatch: a judge prompt does not carry the refused-write fallback", async () => {
  const { calls } = await wave(
    [spec({ id: "w1-d1", topology: "best-of-n", params: { n: 2, criteria: "smallest diff" } })],
    {
      Worker: { result: "candidate", artifacts: [], blocked: false },
      Judge: { verdict: "[1]", reasoning: "smaller", artifacts: [], blocked: false },
    },
  );
  const judge = calls.find((c) => (c.opts.label ?? "").startsWith("Judge"))!;
  assert.ok(!judge.prompt.includes(FALLBACK));
});

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const skill = read("../skills/graph-orchestrator/SKILL.md");
const catalog = read("../skills/graph-orchestrator/catalog.md");

/** Every fenced json example in a document. */
function jsonExamples(doc: string): string[] {
  return [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]!);
}

test("catalog: every example names its report artifacts with a non-.md extension", () => {
  const examples = jsonExamples(catalog);
  assert.ok(examples.length >= 9, `found ${examples.length} examples`);
  for (const ex of examples) assert.doesNotMatch(ex, /\.md\b/, `example names a .md artifact:\n${ex}`);
  assert.match(catalog, /\/scratch\/[\w-]+\.(txt|json|html)/, "examples still name scratch report files");
});

test("SKILL.md: report artifacts are named .txt, .json or .html, not .md", () => {
  assert.match(skill, /[Rr]eport artifacts are named `\.txt`, `\.json` or `\.html`, never `\.md`/);
  for (const ex of jsonExamples(skill)) assert.doesNotMatch(ex, /\.md\b/);
});

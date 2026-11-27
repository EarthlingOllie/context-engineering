/**
 * Planning-model catalog sections (QUA-06, COST-04, ticket 15) are guidance
 * with no runtime seam, so the seam is the document: the catalog must say how
 * parallel code dispatches share a repository and how often the full suite
 * runs, and SKILL.md's wave planning must point to the first.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const catalog = read("../skills/graph-orchestrator/catalog.md");
const skill = read("../skills/graph-orchestrator/SKILL.md");

/** The text of one `## ` section, up to the next `---` rule or the end. */
function section(doc: string, heading: string): string {
  const start = doc.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `section "${heading}" present`);
  const end = doc.indexOf("\n---\n", start);
  return doc.slice(start, end < 0 ? undefined : end);
}

test("catalog: parallel code changes give each generator a worktree on a ticket branch", () => {
  const s = section(catalog, "Parallel code changes");
  assert.match(s, /\*\*Each code dispatch gets a worktree\.\*\*/);
  assert.match(s, /git worktree add SCRATCH\/wt\/<id> -b ticket\/<id>/);
});

test("catalog: an integrate generator-evaluator merges the branches and runs the full suite", () => {
  const s = section(catalog, "Parallel code changes");
  assert.match(s, /\*\*Integration is its own dispatch\.\*\*/);
  assert.match(s, /one integrate `generator-evaluator` whose `dependsOn` names every ticket dispatch/);
  assert.match(s, /merges the `ticket\/<id>` branches/);
  assert.match(s, /`pass_criteria` run the full suite on the merged tree/);
  const example = JSON.parse(s.match(/```json\n([\s\S]*?)```/)![1]!);
  assert.equal(example.topology, "generator-evaluator");
  assert.match(example.params.pass_criteria, /\(the full suite\)/);
  assert.ok(example.dependsOn.length >= 2, "integrate depends on the ticket dispatches");
});

test("catalog: tests per round: targeted tests, one full suite per round, logged and cited", () => {
  const s = section(catalog, "Tests per round");
  assert.match(s, /\*\*Generators run targeted tests\*\*/);
  assert.match(s, /\*\*The evaluator runs the full suite once per round\*\*/);
  assert.match(s, /writes its output to `SCRATCH\/<id>-tests\.log`/);
  assert.match(s, /\*\*A later stage at the same commit cites the log\*\*/);
  assert.match(s, /at any other commit it runs the suite/);
});

test("catalog: no split-fan-out note until a concurrency sweep shows the gain", () => {
  assert.doesNotMatch(catalog, /sibling fan-outs/);
});

test("SKILL.md wave planning points to the parallel-code-changes section", () => {
  const plan = skill.slice(skill.indexOf("### Plan a wave"), skill.indexOf("### Run the wave"));
  assert.match(
    plan,
    /Code dispatches in one wave each get a git worktree on a ticket branch; integration is its own dispatch in the next wave \(catalog, \*\*Parallel code changes\*\*\)\./,
  );
});

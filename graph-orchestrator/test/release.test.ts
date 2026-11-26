/**
 * A release is the plugin manifest, the package manifest and the roadmap moving
 * together. The version must agree everywhere it is declared, and the roadmap
 * must not keep listing work a spec and its tickets already cover.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const pluginVersion = JSON.parse(read("../.claude-plugin/plugin.json")).version as string;
const pkg = JSON.parse(read("../package.json"));
const lock = JSON.parse(read("../package-lock.json"));
const roadmap = read("../../docs/roadmap.md");

const section = (text: string, from: string, to?: string) => {
  const start = text.indexOf(from);
  const end = to ? text.indexOf(to, start) : text.length;
  assert.ok(start >= 0 && end > start, `section ${from} not found`);
  return text.slice(start, end);
};
const rankedTable = section(roadmap, "| Rank |", "## Groups");
const groups = section(roadmap, "## Groups");

test("the plugin manifest, package manifest and lockfile declare the same version", () => {
  assert.equal(pkg.version, pluginVersion);
  assert.equal(lock.version, pluginVersion);
  assert.equal(lock.packages[""].version, pluginVersion);
});

test("the execution-lifecycle release is 0.3.2", () => {
  const spec = read("../../docs/specs/execution-lifecycle/spec.md");
  assert.match(spec, /Ships as one release, 0\.3\.2\./);
  assert.equal(pluginVersion, "0.3.2");
});

test("the roadmap lists the execution-lifecycle spec as covered work with its 6 tickets", () => {
  const covered = section(roadmap, "Covered work", "Finding ids");
  assert.match(covered, /`docs\/specs\/execution-lifecycle\/` \(spec and 6 tickets\)/);
});

test("the roadmap's ranked table and groups no longer list work the execution-lifecycle spec covers", () => {
  for (const id of ["REL-01", "REL-02", "REL-03", "REL-05"]) {
    assert.doesNotMatch(rankedTable, new RegExp(id), `${id} still in the ranked table`);
    assert.doesNotMatch(groups, new RegExp(id), `${id} still in the groups`);
  }
  assert.doesNotMatch(rankedTable, /Fix the launch path/);
  assert.doesNotMatch(rankedTable, /Asks of the harness and platform/);
  assert.doesNotMatch(groups, /Execution and lifecycle/);
});

test("ranks run 1..N without gaps and each (bar the small-fixes rank) appears in exactly one group", () => {
  const ranks = [...rankedTable.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
  assert.deepEqual(ranks, ranks.map((_, i) => i + 1));
  const groupRows = [...groups.matchAll(/^\| \*\*\d\. [^|]+\*\* \|[^|]+\| ([^|]+) \|/gm)].map((m) => m[1] ?? "");
  const grouped = groupRows.flatMap((items) => {
    const m = items.match(/Ranks? ([\d, ()a-z]+?)(;|$)/);
    return m ? [...(m[1] ?? "").matchAll(/\d+/g)].map((n) => Number(n[0])) : [];
  });
  // The rank of remaining small fixes is placed finding by finding, not as a rank.
  const smallFixes = Number(rankedTable.match(/^\| (\d+) \| \*\*Remaining small text/m)?.[1]);
  assert.deepEqual([...grouped].sort((a, b) => a - b), ranks.filter((r) => r !== smallFixes));
});

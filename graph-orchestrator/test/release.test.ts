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

test("the execution-lifecycle spec shipped as 0.3.2", () => {
  const spec = read("../../docs/specs/execution-lifecycle/spec.md");
  assert.match(spec, /Ships as one release, 0\.3\.2\./);
});

test("the fixes release is 0.4.0", () => {
  const spec = read("../../docs/specs/fixes/spec.md");
  assert.match(spec, /Ships as one release, 0\.4\.0\./);
  assert.equal(pluginVersion, "0.4.0");
});

test("the changelog's newest entry is the manifest version and names what the fixes spec shipped", () => {
  const changelog = read("../CHANGELOG.md");
  const newest = changelog.match(/^## (\d+\.\d+\.\d+)/m)?.[1];
  assert.equal(newest, pluginVersion);
  const entry = section(changelog, `## ${pluginVersion}`, "\n## 0.3.2");
  assert.match(entry, /docs\/specs\/fixes\//);
  for (const ticket of ["02", "03", "04", "05", "06", "08", "09", "10", "11", "12", "13", "14", "15"]) {
    assert.match(entry, new RegExp(`ticket ${ticket}\\b`), `changelog misses fixes ticket ${ticket}`);
  }
  // Per-role models (ticket 07) waits on the spike's live run; the changelog must not claim it.
  assert.match(entry, /ticket 07[^.\n]*not in this release/);
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

test("the roadmap lists the fixes spec as covered work with its 16 tickets and release 0.4.0", () => {
  const covered = section(roadmap, "Covered work", "Finding ids");
  assert.match(covered, /`docs\/specs\/fixes\/` \(spec and 16 tickets\), release 0\.4\.0/);
});

test("the roadmap's ranked table and groups no longer list work the fixes spec covers", () => {
  const findings = [
    "REL-04", "REL-06", "REL-08", "QUA-01", "QUA-02", "QUA-03", "QUA-04", "QUA-05", "QUA-06", "QUA-07",
    "QUA-09", "QUA-10", "SPD-01", "SPD-02", "SPD-03", "SPD-04", "COST-01", "COST-02", "COST-04", "COST-05",
  ];
  for (const id of findings) {
    assert.doesNotMatch(rankedTable, new RegExp(id), `${id} still in the ranked table`);
    assert.doesNotMatch(groups, new RegExp(id), `${id} still in the groups`);
  }
  for (const item of [
    /Iterative fan-out evaluator sees only first lines/,
    /A hook message is never a human answer/,
    /Per-role models/,
    /Countable pass criteria/,
    /Scribe and fixed per-dispatch overhead/,
    /Chain reporting/,
    /Rolling launches/,
    /Planning-model changes/,
  ]) {
    assert.doesNotMatch(rankedTable, item, `${item} still in the ranked table`);
  }
  for (const group of [/Verification integrity/, /Orchestrator behaviour/]) {
    assert.doesNotMatch(groups, group, `${group} still in the groups`);
  }
});

test("the roadmap keeps the cache-write platform ask, which the fixes spec only measures", () => {
  assert.match(rankedTable, /COST-03/);
  assert.match(rankedTable, /platform ask/);
});

test("ticket 16 records every dispatch-eval gate and by-hand check the release needs", () => {
  const ticket = read("../../docs/specs/fixes/tickets/16-release-0-4-0.md");
  const gates = section(ticket, "## Dispatch-eval gates", "## By-hand checks");
  for (const t of ["02", "03", "04", "05", "06", "07", "08", "14", "15"]) {
    assert.match(gates, new RegExp(`^\\| ${t} \\|`, "m"), `no gate row for ticket ${t}`);
  }
  const byHand = section(ticket, "## By-hand checks");
  for (const t of ["04", "09", "10", "11", "12", "13"]) {
    assert.match(byHand, new RegExp(`^\\| ${t} \\|`, "m"), `no by-hand row for ticket ${t}`);
  }
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

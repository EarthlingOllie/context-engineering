/**
 * Resuming interrupted runs is SKILL.md behaviour with no runtime seam (the
 * script cannot learn its run id, ticket 01 item 6), so the seam is the
 * documents: SKILL.md must teach where the run id lives, the start-of-turn
 * resume rule, its fallback, and route stopped runs and usage-limit failures
 * to that rule from the integrate table. Ticket 04 must note that the state
 * file alone holds the run id.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const skill = read("../skills/graph-orchestrator/SKILL.md");
const ticket = read("../../docs/specs/execution-lifecycle/tickets/04-resume-interrupted-runs.md");
const readme = read("../README.md");
const adr = read("../../docs/v1/graph-orchestrator/docs/adr/0003-one-workflow-per-dispatch.md");

/** The one sentence of `text` that matches every pattern; anchors a rule to a sentence, not a section. */
const sentence = (text: string, ...patterns: RegExp[]) => {
  const found = text.split(/(?<=[.;:])\s+/).find((s) => patterns.every((p) => p.test(s)));
  assert.ok(found, `no sentence matches all of ${patterns.join(" ")}`);
  return found;
};

const section = (heading: string) => {
  const start = skill.indexOf(heading);
  assert.ok(start >= 0, `SKILL.md has ${heading}`);
  const next = skill.indexOf("\n#", start + heading.length);
  return skill.slice(start, next < 0 ? undefined : next);
};

test("the state file template keeps the run id on the dispatch's FRONTIER line", () => {
  const template = skill.slice(skill.indexOf("## The state file"), skill.indexOf("## The loop"));
  assert.match(template, /FRONTIER:.*run wf_/);
});

test("SKILL.md writes the run id to FRONTIER right after launch, so it survives compaction", () => {
  const resume = section("**The run id.**");
  assert.match(resume, /right after/i);
  assert.match(resume, /FRONTIER/);
  assert.match(resume, /compaction/);
});

test("the resume rule runs at the start of every turn, in both modes, without asking", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /start of every turn/);
  assert.match(rule, /in both modes/);
  assert.match(rule, /without asking/);
  assert.match(rule, /resumeFromRunId/);
  assert.match(rule, /no integrated result/);
  assert.match(rule, /usage limit/);
});

test("the resume rule passes identical args, so finished agents replay from cache", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /same `args`|identical `args`/);
  assert.match(rule, /cache/);
});

test("a failed resume is relaunched fresh once; a second failure is treated as failed", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /relaunch it fresh once/);
  assert.match(rule, /second failure is treated as `failed`/);
});

test("a usage-limit failure is never answered by changing the spec", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /never answered by changing the spec/);
});

test("a stopped run is handled by the rule, not given a status of its own", () => {
  const rule = section("### Resume interrupted runs");
  assert.match(rule, /not a status/);
});

test("the integrate table points stopped runs and usage-limit failures to the resume rule", () => {
  const integrate = section("### Integrate");
  const failedRow = integrate.split("\n").find((l) => l.startsWith("| `failed` |")) ?? "";
  assert.match(failedRow, /usage limit/);
  assert.match(failedRow, /Resume interrupted runs/);
  assert.match(integrate, /stopped run.*Resume interrupted runs|Resume interrupted runs.*stopped run/i);
});

test("ticket 04 notes that the state file alone holds the run id, since the script cannot learn it", () => {
  assert.match(ticket, /state file alone holds the run id/);
  assert.match(section("**The run id.**"), /state file alone holds it/);
});

// B1: resume needs the original args, and after compaction only the state file is re-read.

test("the state file template keeps the args file's path beside the run id", () => {
  const template = skill.slice(skill.indexOf("## The state file"), skill.indexOf("## The loop"));
  assert.match(template, /FRONTIER:.*run wf_… · args SCRATCH\/args\/<id>\.json/);
});

test("after compaction the orchestrator re-reads the state file and, to resume, only the args file it names", () => {
  sentence(skill, /After compaction/, /state file/, /args file/, /resume/);
});

test("the rule's exceptions let the orchestrator write args files and read one back only to resume", () => {
  sentence(section("## The rule"), /state file/, /args file/, /read one back only to resume/);
});

test("at launch each dispatch's exact args are written to SCRATCH/args/<id>.json, before the Workflow call", () => {
  const run = section("### Run the wave");
  sentence(run, /exact `args`/, /SCRATCH\/args\/<id>\.json/, /before/i);
});

test("the run id paragraph puts the args path beside the run id, and a relaunch keeps the args file", () => {
  const runId = section("**The run id.**");
  assert.match(runId, /· run wf_8d319077-f95 · args SCRATCH\/args\/w3-d2\.json/);
  sentence(runId, /relaunch/i, /replaces the id/, /keeps the args file/);
});

test("the resume passes the args file's contents unchanged with resumeFromRunId", () => {
  const rule = section("### Resume interrupted runs");
  sentence(rule, /contents of the args file named on its FRONTIER line/, /unchanged/, /resumeFromRunId/);
});

test("a missing args file is never rebuilt from memory: the dispatch is planned afresh", () => {
  const rule = section("### Resume interrupted runs");
  sentence(rule, /args file is missing/, /never rebuild/, /plan the dispatch afresh/);
});

test("the no-second-scribe-line claim holds only for an unchanged result (M2)", () => {
  const rule = section("### Resume interrupted runs");
  sentence(rule, /scribe line is not written twice/, /usage-limit/, /second line/);
});

test("integrating removes the FRONTIER line except for a usage-limit failure (M3)", () => {
  sentence(section("**The run id.**"), /integrating the result removes the line/, /except/, /usage limit/);
});

test("the README and ADR-0003 say where the args go and why", () => {
  for (const doc of [readme, adr]) {
    sentence(doc, /`<scratch>\/args\/<id>\.json`/, /FRONTIER/, /resumeFromRunId/);
  }
});

test("ticket 04 records the manual restart check (AC7) as an open known issue shipped in 0.3.2, with the live resume evidence", () => {
  sentence(ticket, /Known issue/, /AC7/, /open/, /0\.3\.2/);
  assert.match(ticket, /wf_4a5340e6-dfd/);
  assert.match(ticket, /2 of 2 agents replayed from cache, 0 agent tokens, 123 ms/);
});

test("the red flags allow a dispatch's args file, so the stop rule does not forbid launch or resume", () => {
  const flags = section("## Red flags");
  const line = flags.split("\n").find((l) => /You are about to call Read/.test(l)) ?? "";
  assert.match(line, /`state\.md`/);
  assert.match(line, /args file/);
});

test("the scratch directory lists args/, one <id>.json per launched dispatch", () => {
  sentence(skill, /It holds `state\.md`/, /`args\/` \(one `<id>\.json` per launched dispatch\)/);
});

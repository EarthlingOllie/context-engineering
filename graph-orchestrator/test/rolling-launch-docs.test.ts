/**
 * Rolling launches (ADR-0006) are SKILL.md behaviour with no runtime seam, so
 * the seam is the documents: SKILL.md must teach the rolling launch, the
 * state-file rewrite before each launch, budgets counting launches, the
 * pre-launch dependsOn check and never clearing dependsOn; no live document may
 * still say a wave is waited on in full; ADR-0006 must be accepted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const skill = read("../skills/graph-orchestrator/SKILL.md");
const live = {
  skill,
  catalog: read("../skills/graph-orchestrator/catalog.md"),
  readme: read("../README.md"),
  context: read("../../docs/v1/graph-orchestrator/CONTEXT.md"),
  v2: read("../../docs/v1/graph-orchestrator/docs/v2.md"),
};

test("SKILL.md documents the rolling launch as the next wave number", () => {
  assert.match(skill, /### Rolling launches/);
  assert.match(skill, /launch batch, not a barrier/);
  assert.match(skill, /`dependsOn` names only finished dispatches may launch straight away as the next wave number/);
});

test("SKILL.md rewrites the state file before every launch", () => {
  assert.match(skill, /Rewritten in place after every integration and before every launch/);
  assert.match(skill, /pass the pre-launch check, rewrite the state file, then launch it/);
});

test("SKILL.md budgets count launches, rolling ones included", () => {
  assert.match(skill, /Budgets count launches\. Before any launch, rolling ones included/);
});

test("SKILL.md has the pre-launch dependsOn check and never clears dependsOn", () => {
  assert.match(skill, /\*\*Pre-launch check:\*\* before any launch, every `dependsOn` id must be in a lower-numbered wave; if one is not, move the dispatch to the next wave or make the pair one `chain`/);
  assert.match(skill, /`dependsOn` is never cleared/);
});

test("no live document says a wave is waited on in full", () => {
  const barrier = /integrate once every|once every (workflow|dispatch|one) (of the wave )?has reported|waiting for the whole wave|wait(ed)? on in full|strict wave barrier/i;
  for (const [name, text] of Object.entries(live)) assert.doesNotMatch(text, barrier, name);
});

test("ADR-0006 is accepted", () => {
  const adr = read("../../docs/v1/graph-orchestrator/docs/adr/0006-a-wave-is-a-launch-batch.md");
  assert.match(adr, /^---\nstatus: accepted\n---/);
});

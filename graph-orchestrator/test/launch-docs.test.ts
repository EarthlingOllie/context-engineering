/**
 * The launch is SKILL.md behaviour with no runtime seam, so the seam here is
 * the documents themselves: SKILL.md, the README and ADR-0003 must teach one
 * and the same launch, the route ticket 01's spike observed to work (a copy of
 * the plugin's workflows in the session scratch directory). The plugin-root
 * scriptPath was refused in a live session and must not be taught anywhere.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const docs = {
  skill: read("../skills/graph-orchestrator/SKILL.md"),
  readme: read("../README.md"),
  adr: read("../../docs/v1/graph-orchestrator/docs/adr/0003-one-workflow-per-dispatch.md"),
};

const LAUNCH = /return await workflow\(\{ scriptPath: '([^']+)' \}, args\)/g;
const launches = (text: string) => [...text.matchAll(LAUNCH)].map((m) => (m[1] ?? "").replace(/^SCRATCH\//, "<scratch>/"));

test("SKILL.md documents exactly one launch: the wrapper calls the scratch copy of dispatch.js", () => {
  assert.deepEqual(launches(docs.skill), ["<scratch>/plugin/workflows/dispatch.js"]);
});

test("the README and ADR-0003 show the same launch as SKILL.md", () => {
  const [skillLaunch] = launches(docs.skill);
  assert.deepEqual(launches(docs.readme), [skillLaunch]);
  assert.deepEqual(launches(docs.adr), [skillLaunch]);
});

test("no document teaches the refused plugin-root scriptPath", () => {
  for (const [name, text] of Object.entries(docs)) {
    assert.doesNotMatch(text, /scriptPath: '(\$\{CLAUDE_PLUGIN_ROOT\}|<plugin root>)\/workflows/, name);
  }
});

test("SKILL.md copies the workflows into SCRATCH at kickoff as one of the exceptions to the rule", () => {
  assert.match(docs.skill, /Six exceptions, and only these:/);
  assert.match(docs.skill, /cp -R "\$\{CLAUDE_PLUGIN_ROOT\}\/workflows" "SCRATCH\/plugin\/"/);
});

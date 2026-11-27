/**
 * Context hygiene and human waits (QUA-10, QUA-09, SPD-02) are SKILL.md
 * behaviour with no runtime seam, so the seam is the documents: SKILL.md must
 * send the diagram as a file with a short summary, default `maxLines` to 4 with
 * more than 8 needing a reason, keep standing rules in one brief file, keep
 * credentials out of context, and launch independent dispatches before asking
 * a question that carries options and a recommended default. No live document
 * may tell the orchestrator to paste the diagram.
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

test("the final reply sends the diagram file with a summary of at most 3 lines", () => {
  assert.match(skill, /send `SCRATCH\/session\.mmd` as a file/);
  assert.match(skill, /a summary of at most 3 lines/);
  assert.match(skill, /never its text/);
});

test("no live document tells the orchestrator to paste the diagram", () => {
  const paste = /diagram,? verbatim|verbatim,? in a ```mermaid|paste (the|its) diagram|diagram (pasted|in a ```mermaid block)/i;
  for (const [name, text] of Object.entries(live)) assert.doesNotMatch(text, paste, name);
});

test("default maxLines is 4 and above 8 needs a reason", () => {
  assert.match(skill, /`maxLines` defaults to 4/);
  assert.match(skill, /above 8 needs a reason/);
});

test("standing rules go once into the brief file, named in each spec's context", () => {
  assert.match(skill, /`SCRATCH\/brief\.md`/);
  assert.match(skill, /Standing rules \(branch policy, test rules, authorisations, attribution lines\) go once into `SCRATCH\/brief\.md` at kickoff/);
  assert.match(skill, /each spec's `context` carries the line `brief: SCRATCH\/brief\.md`/);
  assert.match(skill, /the state file, the brief file and each dispatch's args file/);
});

test("credentials never go in context", () => {
  assert.match(skill, /Never put a credential in `context`, the brief file or the state file; name the file or variable that holds it/);
});

test("before asking, independent dispatches launch and the question carries a recommended default", () => {
  assert.match(skill, /### Asking/);
  assert.match(skill, /Before asking, launch every FRONTIER dispatch that does not depend on the answer/);
  assert.match(skill, /options with a recommended default/);
});

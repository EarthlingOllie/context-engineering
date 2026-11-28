/**
 * Final reply (finding C, by-hand session 2026-11-27): the session's final
 * reply summarised with a ~12-row table instead of STATUS plus at most 3
 * lines. SKILL.md now fixes the reply as a template, and the renderer, the
 * last command the orchestrator runs, prints that same template right after
 * it saves the diagram, so the shape is in front of the orchestrator at the
 * moment it writes the reply. The skeleton goes to stderr: stdout stays the
 * diagram alone, which the skill's redirect keeps out of the window.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalReplySkeleton } from "../src/trace/final-reply.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const skill = read("../skills/graph-orchestrator/SKILL.md");
const cli = new URL("../scripts/render-trace.js", import.meta.url).pathname;
const fixture = read("./fixtures/single-wave.jsonl");

const section = (text: string, from: string, to: string) => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `section ${from} not found`);
  return text.slice(start, end);
};

test("the skeleton names its sections in order: UNVERIFIED, STATUS and summary, ARTIFACTS, DECISIONS, then the diagram as a file", () => {
  const s = finalReplySkeleton("/tmp/x/session.mmd");
  const order = ["UNVERIFIED", "STATUS:", "at most 3", "ARTIFACTS", "DECISIONS", "send /tmp/x/session.mmd as a file"].map((k) => s.indexOf(k));
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1]!)), `sections in order: ${order}`);
  assert.doesNotMatch(s, /\|/, "the skeleton holds no table");
});

test("SKILL.md's final-reply template is the skeleton the renderer prints, for SCRATCH/session.mmd", () => {
  const finish = section(skill, "### Finish", "## Rationalizations");
  const block = /Your final reply is this template[^\n]*\n\n```\n([\s\S]*?)```/.exec(finish);
  assert.ok(block, "Finish holds the template in a fenced block");
  assert.equal(block[1], finalReplySkeleton("SCRATCH/session.mmd"));
});

test("Red flags name a table in the final reply", () => {
  const flags = section(skill, "## Red flags", "## When not to use");
  assert.match(flags, /table in the final reply/);
});

test("the CLI prints the skeleton on stderr after saving the diagram, naming the saved path; stdout stays the diagram", () => {
  const dir = mkdtempSync(join(tmpdir(), "go-final-"));
  const trace = join(dir, "trace.jsonl");
  writeFileSync(trace, fixture);
  const out = join(dir, "session.mmd");
  const r = spawnSync("node", [cli, trace, "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, readFileSync(out, "utf8"), "stdout is the saved diagram and nothing else");
  assert.ok(r.stderr.includes(finalReplySkeleton(out)), "stderr carries the skeleton for the saved path");
  assert.ok(r.stderr.indexOf(`wrote ${out}`) < r.stderr.indexOf("UNVERIFIED"), "the skeleton follows the save");
});

test("the CLI prints no skeleton when it saves nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "go-final-"));
  const r = spawnSync("node", [cli, join(dir, "missing.jsonl")], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stderr, /UNVERIFIED/);
  assert.doesNotMatch(execFileSync("node", [cli, "--help"], { encoding: "utf8" }), /UNVERIFIED/);
});

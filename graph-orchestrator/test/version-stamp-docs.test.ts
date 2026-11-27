/**
 * B-03 docs seam: the state file's MODE line records the build that ran the
 * session, taken from the `version` a returned dispatch carries, so a resumed
 * or compacted session still knows which plugin build produced its runs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const skill = readFileSync(new URL("../skills/graph-orchestrator/SKILL.md", import.meta.url), "utf8");

test("B-03: SKILL.md's MODE line records the plugin version", () => {
  const mode = skill.split("\n").find((l) => l.startsWith("MODE:")) ?? "";
  assert.match(mode, /· plugin <version> ·/);
});

test("B-03: SKILL.md says where the version comes from: the returned dispatch's `version`, package version plus git short commit", () => {
  const rule = skill.split("\n").find((l) => /`plugin <version>`/.test(l) && !l.startsWith("MODE:")) ?? "";
  assert.match(rule, /`version`/);
  assert.match(rule, /package version/);
  assert.match(rule, /git short commit/);
});

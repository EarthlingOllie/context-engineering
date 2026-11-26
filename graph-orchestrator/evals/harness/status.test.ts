/**
 * Real status at the bundle seam: the built dispatch script, run by the eval
 * harness against a fake engine. Asserts only on what comes back and what is
 * logged: a `failed` result carries what an agent threw, and every run's last
 * log line is `STATUS <status>`, after the scribe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHarness, type HarnessResult } from "./harness.ts";
import { stubEngine } from "./stub-engine.ts";
import type { Engine } from "./runtime.ts";

const bundleSource = readFileSync(new URL("../../workflows/dispatch.js", import.meta.url), "utf8");
const scratch = () => mkdtempSync(join(tmpdir(), "status-"));
const sampleArgs = (file: string) => {
  const args = (JSON.parse(readFileSync(new URL(`../samples/${file}`, import.meta.url), "utf8")) as { args: Record<string, unknown> }).args;
  return { ...args, scratch: scratch() };
};

/** The usage-limit text an agent call throws when the account is limited (spec: "a usage limit"). */
const USAGE_LIMIT = "Claude AI usage limit reached|1764158400";

/** Every role agent throws a usage-limit error; the scribe still writes, as the stub's does. */
function limitedEngine(message = USAGE_LIMIT): Engine {
  const stub = stubEngine();
  return async (req) => {
    if (req.prompt.startsWith("ROLE: scribe")) return stub(req);
    throw new Error(message);
  };
}

const run = (args: unknown, engine: Engine) => runHarness({ bundleSource, args, engine, mainModel: "m", cap: 2 });
const lastLog = (r: HarnessResult) => r.logs[r.logs.length - 1]?.message;

function assertStatusLine(r: HarnessResult, status: string) {
  assert.equal(r.error, null);
  assert.equal(r.return?.["status"], status);
  assert.equal(lastLog(r), `STATUS ${status}`);
  // after the scribe: the scribe ran, and no log follows the STATUS line
  assert.equal(r.agents[r.agents.length - 1]?.role, "scribe");
}

test("a single whose worker throws a usage-limit error returns failed with that text, within the line limit", async () => {
  const r = await run(sampleArgs("01-single-docs.json"), limitedEngine());
  assertStatusLine(r, "failed");
  const result = String(r.return?.["result"]);
  assert.ok(result.includes(USAGE_LIMIT), result);
  assert.ok(result.split("\n").length <= 12);
});

test("a generator-evaluator whose generator throws reports the thrown text, and a one-line contract still holds it", async () => {
  const args = sampleArgs("03-generator-evaluator-python.json") as unknown as { dispatch: { returns: { shape: string; maxLines: number } } };
  args.dispatch.returns = { shape: "one line", maxLines: 1 };
  const multi = `${USAGE_LIMIT}\nsecond line of the error\nthird line`;
  const r = await run(args, limitedEngine(multi));
  assertStatusLine(r, "failed");
  const result = String(r.return?.["result"]);
  assert.equal(result.split("\n").length, 1);
  assert.ok(result.includes(USAGE_LIMIT), result);
});

test("a chain whose stage agent throws carries the thrown text up to the chain's failed result", async () => {
  const r = await run(sampleArgs("09-chain-stage-2-fails.json"), limitedEngine());
  assertStatusLine(r, "failed");
  assert.ok(String(r.return?.["result"]).includes(USAGE_LIMIT));
});

test("a done dispatch ends with STATUS done", async () => {
  assertStatusLine(await run(sampleArgs("03-generator-evaluator-python.json"), stubEngine()), "done");
});

test("an exhausted dispatch ends with STATUS exhausted", async () => {
  assertStatusLine(await run(sampleArgs("05-generator-evaluator-exhausted.json"), stubEngine({ evaluator: "fail" })), "exhausted");
});

test("a blocked dispatch ends with STATUS blocked", async () => {
  const engine: Engine = async (req) => {
    if (req.prompt.startsWith("ROLE: scribe")) return stubEngine()(req);
    return { output: { result: "", artifacts: [], blocked: true, question: "which file?" } };
  };
  assertStatusLine(await run(sampleArgs("01-single-docs.json"), engine), "blocked");
});

test("an over-budget dispatch, refused before any agent ran, ends with STATUS over_budget", async () => {
  const r = await run(sampleArgs("15-fan-out-over-budget.json"), stubEngine());
  assertStatusLine(r, "over_budget");
  assert.deepEqual(r.agents.map((a) => a.role), ["scribe"]);
});

test("a failed dispatch, refused before any agent ran, ends with STATUS failed", async () => {
  const args = sampleArgs("01-single-docs.json") as unknown as { dispatch: Record<string, unknown> };
  args.dispatch["topology"] = "no-such-topology";
  const r = await run(args, stubEngine());
  assertStatusLine(r, "failed");
  assert.deepEqual(r.agents.map((a) => a.role), ["scribe"]);
});

test("a run whose args are not a dispatch spec, or whose scribe throws, still ends with STATUS failed / its status", async () => {
  const bad = await run({ now: "x", scratch: scratch(), dispatch: null }, stubEngine());
  assert.equal(lastLog(bad), "STATUS failed");
  const noScribe: Engine = async (req) => {
    if (req.prompt.startsWith("ROLE: scribe")) throw new Error("scribe down");
    return stubEngine()(req);
  };
  const r = await run(sampleArgs("03-generator-evaluator-python.json"), noScribe);
  assert.equal(r.return?.["status"], "done");
  assert.equal(lastLog(r), "STATUS done");
});

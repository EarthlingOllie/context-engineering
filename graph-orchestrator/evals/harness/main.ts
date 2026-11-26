/**
 * The harness entry point inside the sandbox:
 *
 *   node --experimental-strip-types /opt/harness/main.ts --bundle /opt/plugin/workflows/dispatch.js \
 *     --args /work/args.json --out /work/result.json --cap 2 --model claude-opus-5-5 \
 *     [--role-model evaluator=claude-haiku-5-5 ...] [--skills /opt/skills] [--cwd /work] \
 *     [--stub [--stub-delay-ms 200] [--stub-evaluator pass|fail] [--stub-serve-model claude-opus-5-5]]
 *
 * --role-model forces one role onto another model without changing the
 * plugin (repeatable; the baseline passes none, so every role runs on
 * --model). --stub-serve-model makes the stub report every call as served on
 * that model, a dry run of the bridge falling back to the main model.
 *
 * --stub replaces the engine with canned answers (stub-engine.ts) so the
 * pipeline can be dry-run with no model call. --stub-delay-ms makes each
 * non-scribe answer take that long, so queueing under the cap shows;
 * --stub-evaluator fail makes every evaluator fail, so the dry run reaches
 * exhausted.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { runHarness } from "./harness.ts";
import { sdkEngine } from "./sdk-engine.ts";
import { stubEngine } from "./stub-engine.ts";

const { values: opt } = parseArgs({
  options: {
    bundle: { type: "string" },
    args: { type: "string" },
    out: { type: "string" },
    cap: { type: "string", default: "2" },
    model: { type: "string" },
    skills: { type: "string" },
    cwd: { type: "string", default: process.cwd() },
    stub: { type: "boolean", default: false },
    "stub-delay-ms": { type: "string", default: "0" },
    "stub-evaluator": { type: "string", default: "pass" },
    "stub-serve-model": { type: "string" },
    "role-model": { type: "string", multiple: true, default: [] },
  },
});
for (const k of ["bundle", "args", "out", "model"] as const) if (!opt[k]) throw new Error(`--${k} is required`);

const evaluator = opt["stub-evaluator"];
if (evaluator !== "pass" && evaluator !== "fail") throw new Error("--stub-evaluator is pass or fail");
const roleModels: Record<string, string> = {};
for (const pair of opt["role-model"] ?? []) {
  const m = /^([a-z]+)=(\S+)$/.exec(pair);
  if (!m) throw new Error(`--role-model is role=model, got ${pair}`);
  roleModels[m[1]!] = m[2]!;
}
const serveModel = opt["stub-serve-model"];
const engine = opt.stub
  ? stubEngine({ delayMs: Number(opt["stub-delay-ms"]) || 0, evaluator, ...(serveModel ? { serveModel } : {}) })
  : await sdkEngine({ cwd: opt.cwd!, skillsPlugin: opt.skills ?? null });
const result = await runHarness({
  bundleSource: readFileSync(opt.bundle!, "utf8"),
  args: JSON.parse(readFileSync(opt.args!, "utf8")),
  engine,
  mainModel: opt.model!,
  roleModels,
  cap: Number(opt.cap),
});
mkdirSync(dirname(opt.out!), { recursive: true });
writeFileSync(opt.out!, JSON.stringify({ ...result, stub: opt.stub }, null, 2));
console.log(JSON.stringify({ status: result.return?.["status"] ?? "error", wallClockMs: result.wallClockMs, agents: result.agents.length, out: opt.out }));
process.exit(result.error ? 1 : 0);

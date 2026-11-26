/**
 * The harness entry point inside the sandbox:
 *
 *   node --experimental-strip-types /opt/harness/main.ts --bundle /opt/plugin/workflows/dispatch.js \
 *     --args /work/args.json --out /work/result.json --cap 2 --model claude-opus-5-5 \
 *     [--skills /opt/skills] [--cwd /work] [--stub [--stub-delay-ms 200]]
 *
 * --stub replaces the engine with canned answers (the scribe really writes the
 * trace file) so the pipeline can be dry-run with no model call. A partition
 * agent gets as many sub-tasks as it was allowed; --stub-delay-ms makes each
 * non-scribe answer take that long, so queueing under the cap shows in a dry run.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { runHarness } from "./harness.ts";
import { sdkEngine } from "./sdk-engine.ts";
import type { Engine } from "./runtime.ts";

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
  },
});
for (const k of ["bundle", "args", "out", "model"] as const) if (!opt[k]) throw new Error(`--${k} is required`);

/** Canned answers: the worker reports nothing useful, the scribe writes the trace lines it was given. */
const stubDelayMs = Number(opt["stub-delay-ms"]) || 0;
const stubEngine: Engine = async (req) => {
  if (req.prompt.startsWith("ROLE: scribe")) {
    const file = /to the file (.+?), exactly as given/.exec(req.prompt)?.[1];
    if (!file) throw new Error("stub scribe: no trace file in the prompt");
    const lines = req.prompt.slice(req.prompt.indexOf("<<<TRACE\n") + 9, req.prompt.indexOf("\nTRACE>>>")).split("\n");
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, lines.map((l) => l + "\n").join(""));
    const totalLines = readFileSync(file, "utf8").split("\n").filter(Boolean).length;
    return { output: { appended: lines.length, totalLines }, record: { stub: true } };
  }
  if (stubDelayMs > 0) await new Promise((r) => setTimeout(r, stubDelayMs));
  if (req.label?.startsWith("Partition")) {
    const width = Number(/at most (\d+) independent sub-tasks/.exec(req.prompt)?.[1] ?? 1);
    return { output: { subtasks: Array.from({ length: width }, (_, i) => `stub sub-task ${i + 1}`), blocked: false }, record: { stub: true } };
  }
  if (/Evaluator/.test(req.label ?? "")) return { output: { pass: true, feedback: "", blocked: false }, record: { stub: true } };
  return { output: { result: "stub: no model call was made", artifacts: [], blocked: false }, record: { stub: true } };
};

const engine = opt.stub ? stubEngine : await sdkEngine({ cwd: opt.cwd!, skillsPlugin: opt.skills ?? null });
const result = await runHarness({
  bundleSource: readFileSync(opt.bundle!, "utf8"),
  args: JSON.parse(readFileSync(opt.args!, "utf8")),
  engine,
  mainModel: opt.model!,
  cap: Number(opt.cap),
});
mkdirSync(dirname(opt.out!), { recursive: true });
writeFileSync(opt.out!, JSON.stringify({ ...result, stub: opt.stub }, null, 2));
console.log(JSON.stringify({ status: result.return?.["status"] ?? "error", wallClockMs: result.wallClockMs, agents: result.agents.length, out: opt.out }));
process.exit(result.error ? 1 : 0);

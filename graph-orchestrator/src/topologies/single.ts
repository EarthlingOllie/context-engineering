// ---------- single ----------
import type { DispatchResult, DispatchSpec } from "../types.ts";
import { ROLE_SCHEMAS, buildPrompt } from "../roles.ts";
import { type TopologyContext, type TopologyImpl, callRole, contractOf, fail, readWorkOutput, roleEntry } from "./shared.ts";

/** The worker's final step: append the dispatch's trace lines itself, so the dispatch needs no scribe. */
export function traceStep(file: string, lines: string[]): { title: string; body: string } {
  return {
    title: "TRACE (your final step, after the task is done)",
    body: [
      `Append the ${lines.length} line(s) between the markers below to the file ${file}, exactly as given, in order, each terminated by a newline.`,
      "Create the directory and the file if they do not exist. Append with a single write; do not read, reorder, reformat or alter any existing line.",
      "<<<TRACE",
      ...lines,
      "TRACE>>>",
      "Report the number of lines you appended in `traceAppended` and the total number of lines in the file afterwards in `traceTotalLines`.",
      "If you are blocked, or the write fails, append nothing and report 0: the lines then get written for you.",
    ].join("\n"),
  };
}

const workerSchema = ROLE_SCHEMAS.worker as { properties: Record<string, unknown>; required: string[] };
const TRACING_WORKER_SCHEMA = {
  ...workerSchema,
  properties: {
    ...workerSchema.properties,
    traceAppended: { type: "number", description: "How many TRACE lines you appended. 0 if you appended none." },
    traceTotalLines: { type: "number", description: "Total lines in the trace file afterwards. 0 if you appended none." },
  },
  required: [...workerSchema.required, "traceAppended"],
};

async function runSingle(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const trace = ctx.selfTrace && ctx.selfTrace.id === spec.id ? ctx.selfTrace : undefined;
  const out = await callRole(
    ctx,
    spec,
    "worker",
    buildPrompt({
      role: "worker",
      task: spec.task,
      context: spec.context,
      entry: roleEntry(spec, "worker"),
      returns,
      artifactDir: ctx.artifactDir,
      ...(trace ? { sections: [traceStep(trace.file, trace.lines)] } : {}),
    }),
    { role: "worker" },
    trace ? TRACING_WORKER_SCHEMA : ROLE_SCHEMAS.worker,
  );
  if (!out) return fail(spec, "worker returned nothing", 1);
  if (trace) {
    trace.appended = Math.max(0, Math.floor(Number(out["traceAppended"]) || 0));
    trace.totalLines = Math.max(0, Math.floor(Number(out["traceTotalLines"]) || 0));
  }
  const { question, ...work } = readWorkOutput(out, returns.maxLines, ctx);
  const base = { id: spec.id, ...work, iterations: 1 };
  return question ? { ...base, status: "blocked", question } : { ...base, status: "done" };
}

export const single: TopologyImpl = { demand: () => 1, run: runSingle };

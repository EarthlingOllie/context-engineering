// ---------- single ----------
import type { DispatchResult, DispatchSpec } from "../types.ts";
import { ROLE_SCHEMAS, buildPrompt } from "../roles.ts";
import { clockSteps, hasPlaceholder, hasRefusalPlaceholder, refusalSteps } from "../clock.ts";
import { type TopologyContext, type TopologyImpl, blockedQuestion, callRole, contractOf, cutLines, fail, readWorkOutput, recordCriteria, recordRound, roleEntry, str } from "./shared.ts";

/**
 * An evaluator-only review (finding B): a `single` that names `roles.evaluator` and no `roles.worker`. It runs one
 * evaluator instead of a worker, so its line carries the verdict and first blocking reason.
 */
export function isReview(spec: Partial<DispatchSpec>): boolean {
  const roles = spec.roles && typeof spec.roles === "object" ? spec.roles : {};
  return spec.topology === "single" && !!roles["evaluator"] && !roles["worker"];
}

/**
 * The review: one evaluator against `params.pass_criteria` (recorded on the line) or, without them, the criteria
 * the task names. Pass returns `PASS`; fail returns `FAIL` and the feedback, cut to the contract; both are `done`,
 * since the review itself finished. A blocked evaluator blocks the dispatch with its question. Every outcome is
 * recorded as the dispatch's one evaluator round.
 */
async function runReview(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const given = typeof spec.params?.["pass_criteria"] === "string" ? String(spec.params["pass_criteria"]).trim() : "";
  if (given) recordCriteria(ctx, spec, given);
  const ev = await callRole(
    ctx,
    spec,
    "evaluator",
    buildPrompt({
      role: "evaluator",
      task: spec.task,
      context: spec.context,
      entry: roleEntry(spec, "evaluator"),
      returns,
      artifactDir: ctx.artifactDir,
      sections: [
        { title: "PASS CRITERIA", body: given || "the criteria the TASK names" },
        { title: "SUBMISSION (an evaluator-only review)", body: "the artifacts the TASK and CONTEXT name; open them from disk" },
      ],
    }),
    { role: "evaluator" },
  );
  if (!ev) return fail(spec, "evaluator returned nothing", 1);
  const question = blockedQuestion(ev, "evaluator");
  if (question) {
    recordRound(ctx, spec, 1, "blocked", question);
    return { id: spec.id, status: "blocked", result: "BLOCKED", artifacts: [], question, iterations: 1 };
  }
  const pass = ev["pass"] === true;
  const feedback = str(ev, "feedback").trim();
  recordRound(ctx, spec, 1, pass ? "pass" : "fail", feedback);
  const result = pass ? "PASS" : cutLines(feedback ? `FAIL\n${feedback}` : "FAIL", returns.maxLines, ctx);
  return { id: spec.id, status: "done", result, artifacts: [], iterations: 1 };
}

/** The worker's final step: append the dispatch's trace lines itself, so the dispatch needs no scribe. */
export function traceStep(file: string, lines: string[], argsFile?: string): { title: string; body: string } {
  const clock = argsFile && hasPlaceholder(lines) ? clockSteps(argsFile) : [];
  const counts = hasRefusalPlaceholder(lines) ? refusalSteps() : [];
  const asGiven = clock.length || counts.length ? `exactly as given apart from the ${clock.length ? "time " : ""}${clock.length && counts.length ? "and " : ""}${counts.length ? "count " : ""}placeholders` : "exactly as given";
  return {
    title: "TRACE (your final step, after the task is done)",
    body: [
      `Append the ${lines.length} line(s) between the markers below to the file ${file}, ${asGiven}, in order, each terminated by a newline.`,
      "Create the directory and the file if they do not exist. Append with a single write; do not read, reorder, reformat or alter any existing line.",
      ...clock,
      ...counts,
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
  if (isReview(spec)) return runReview(ctx, spec);
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
      ...(trace ? { sections: [traceStep(trace.file, trace.lines, trace.argsFile)] } : {}),
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

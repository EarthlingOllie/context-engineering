// ---------- fan-out ----------
import type { DispatchResult, DispatchSpec, DispatchStatus, FanOutParams, ReturnContract, RoleEntry } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { DEFAULT_WIDTH, MAX_WIDTH, type TopologyContext, type TopologyImpl, type RoleLabel, blockedQuestion, callRole, contractOf, cutLines, fail, int, overBudget, readWorkOutput, roleEntry, strArr, uniq } from "./shared.ts";

/** One branch's outcome: the result fields a dispatch would carry, plus which sub-task it was (`index` is 0-based). */
export type Branch = Pick<DispatchResult, "status" | "result" | "artifacts" | "question"> & { index: number; task: string };

/**
 * The partition step: one worker turns the instruction into at most `width`
 * sub-tasks. Either the sub-tasks, or the result to return (blocked, or failed
 * when the agent returned nothing or no sub-task). `name` prefixes the messages;
 * `label` is the agent label after the dispatch id.
 */
export async function partitionStep(
  ctx: TopologyContext,
  spec: DispatchSpec,
  instruction: string,
  width: number,
  opts: { name: string; label: RoleLabel; workerEntry: RoleEntry | undefined },
): Promise<{ ok: true; subtasks: string[] } | { ok: false; result: DispatchResult }> {
  const part = await callRole(
    ctx,
    spec,
    "worker",
    buildPrompt({
      role: "worker",
      task: `Partition this task into at most ${width} independent sub-tasks: ${spec.task}`,
      context: spec.context,
      entry: opts.workerEntry,
      returns: { shape: "one imperative sentence per sub-task, each self-contained and non-overlapping", maxLines: width },
      artifactDir: ctx.artifactDir,
      sections: [{ title: "PARTITION INSTRUCTION", body: instruction }],
    }),
    opts.label,
    {
      type: "object",
      properties: {
        subtasks: { type: "array", items: { type: "string" }, description: `At most ${width} independent sub-tasks, one imperative sentence each.` },
        blocked: { type: "boolean" },
        question: { type: "string" },
      },
      required: ["subtasks", "blocked"],
    },
  );
  if (!part) return { ok: false, result: fail(spec, `${opts.name}: partition agent returned nothing`, 1) };
  const pq = blockedQuestion(part);
  if (pq) return { ok: false, result: { id: spec.id, status: "blocked", result: "", artifacts: [], question: pq, iterations: 1 } };
  const all = strArr(part, "subtasks");
  if (all.length === 0) return { ok: false, result: fail(spec, `${opts.name}: partition produced no sub-tasks`, 1) };
  if (all.length > width) ctx.rt.log(`${spec.id}: partition returned more than ${width} sub-tasks; extras dropped`);
  return { ok: true, subtasks: all.slice(0, width) };
}

/**
 * The branch step: one worker per sub-task, in parallel, each cut to
 * `branchReturns`. `label` names branch i of n after the dispatch id;
 * `context` is the context every branch sees before its own branch line.
 */
export async function branchStep(
  ctx: TopologyContext,
  spec: DispatchSpec,
  subtasks: string[],
  opts: { branchReturns: ReturnContract; workerEntry: RoleEntry | undefined; context: string[]; label: (i: number, n: number, task: string) => RoleLabel; kind: string },
): Promise<Branch[]> {
  const n = subtasks.length;
  const raw = await ctx.rt.parallel(
    subtasks.map((task, i) => async (): Promise<Branch> => {
      const out = await callRole(
        ctx,
        spec,
        "worker",
        buildPrompt({
          role: "worker",
          task,
          context: [...opts.context, `this is branch ${i + 1} of ${n} of ${opts.kind} whose parent task is: ${spec.task}`],
          entry: opts.workerEntry,
          returns: opts.branchReturns,
          artifactDir: ctx.artifactDir,
        }),
        opts.label(i + 1, n, task),
      );
      if (!out) return { index: i, task, status: "failed", result: "worker returned nothing", artifacts: [] };
      const { question, ...work } = readWorkOutput(out, opts.branchReturns.maxLines);
      const b: Branch = { index: i, task, status: question ? "blocked" : "done", ...work };
      if (question) b.question = question;
      return b;
    }),
  );
  return raw.map((b, i) => b ?? { index: i, task: subtasks[i] ?? "", status: "failed", result: "branch did not return", artifacts: [] });
}

/** The blocked branches' questions, one line each, or undefined when none blocked. */
export function branchQuestions(branches: Branch[], prefix = ""): string | undefined {
  const blocked = branches.filter((b) => b.status === "blocked");
  return blocked.length ? blocked.map((b) => `${prefix}branch ${b.index + 1} (${b.task}): ${b.question}`).join("\n") : undefined;
}

/** When no branch finished: `blocked` if any blocked (with their questions), else `failed`; one line per branch. */
export function noBranchFinished(spec: DispatchSpec, branches: Branch[], maxLines: number): DispatchResult {
  const status: DispatchStatus = branches.some((b) => b.status === "blocked") ? "blocked" : "failed";
  const base: DispatchResult = { id: spec.id, status, result: cutLines(branches.map((b) => `branch ${b.index + 1} ${b.status}: ${b.question ?? b.result}`).join("\n"), maxLines), artifacts: uniq(branches.flatMap((b) => b.artifacts)), iterations: 1 };
  const q = branchQuestions(branches);
  return q ? { ...base, question: q } : base;
}

async function runFanOut(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const params = spec.params as Partial<FanOutParams>;
  const split = params.split;
  const reducerEntry = roleEntry(spec, "reducer") ?? (params.reducer && typeof params.reducer === "object" ? params.reducer : undefined);
  const hasReducer = Boolean(reducerEntry) || params.reducer === true;
  const workerEntry = roleEntry(spec, "worker");

  // 1. Decide the sub-tasks: explicit list, or a partition agent following the instruction.
  let subtasks: string[];
  if (Array.isArray(split)) {
    subtasks = split.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    if (subtasks.length === 0) return fail(spec, "fan-out: `split` list is empty");
    if (subtasks.length > MAX_WIDTH) return overBudget(spec, `fan-out: ${subtasks.length} sub-tasks exceeds the width cap of ${MAX_WIDTH}; split differently or chain two fan-outs`);
    if (params.width !== undefined && int(params.width, subtasks.length) !== subtasks.length) {
      ctx.rt.log(`${spec.id}: width ${String(params.width)} ignored; explicit split has ${subtasks.length} sub-tasks`);
    }
  } else if (typeof split === "string" && split.trim()) {
    const width = int(params.width, DEFAULT_WIDTH);
    if (width > MAX_WIDTH) return overBudget(spec, `fan-out: width ${width} exceeds the cap of ${MAX_WIDTH}`);
    const part = await partitionStep(ctx, spec, split, width, { name: "fan-out", label: { role: "partition" }, workerEntry });
    if (!part.ok) return part.result;
    subtasks = part.subtasks;
  } else {
    return fail(spec, "fan-out: `params.split` must be a list of sub-tasks or a partition instruction");
  }

  // 2. Branches in parallel. Without a reducer the inline results are concatenated, so each gets a share of the lines.
  const n = subtasks.length;
  const branchReturns: ReturnContract = hasReducer ? returns : { shape: returns.shape, maxLines: Math.max(1, Math.floor(returns.maxLines / n)) };
  const branches = await branchStep(ctx, spec, subtasks, { branchReturns, workerEntry, context: spec.context, label: (i, k, task) => ({ role: "worker", index: i, count: k, task }), kind: "a fan-out" });
  const finished = branches.filter((b) => b.status === "done");
  const artifacts = uniq(branches.flatMap((b) => b.artifacts));
  const gapQuestion = branchQuestions(branches);

  if (finished.length === 0) return noBranchFinished(spec, branches, returns.maxLines);

  // 3. Reduce over the finished branches, noting the gaps; or concatenate (also the fallback when the reducer returns nothing).
  const concatenated = () => cutLines(branches.map((b) => (b.status === "done" ? `[${b.index + 1}] ${b.result}` : `[${b.index + 1}] ${b.status}: ${b.question ?? b.result}`)).join("\n"), returns.maxLines);
  let result: string;
  let extraArtifacts: string[] = [];
  if (hasReducer) {
    const body = branches
      .map((b) => (b.status === "done" ? `branch ${b.index + 1} (done) — ${b.task}\n${b.result}\nartifacts: ${b.artifacts.length ? b.artifacts.join(", ") : "none"}` : `branch ${b.index + 1} (${b.status}) — ${b.task}\nGAP: ${b.question ?? b.result}`))
      .join("\n\n");
    const red = await callRole(
      ctx,
      spec,
      "reducer",
      buildPrompt({ role: "reducer", task: spec.task, context: spec.context, entry: reducerEntry, returns, artifactDir: ctx.artifactDir, sections: [{ title: "BRANCH RESULTS", body }] }),
      { role: "reducer" },
    );
    if (red) {
      const { question: rq, ...work } = readWorkOutput(red, returns.maxLines);
      // A blocked reducer blocks the dispatch; the blocked branches' questions still travel with it, as on the done path.
      if (rq) return { id: spec.id, status: "blocked", result: work.result, artifacts, question: gapQuestion ? `${rq}\n${gapQuestion}` : rq, iterations: 1 };
      result = work.result;
      extraArtifacts = work.artifacts;
    } else {
      ctx.rt.log(`${spec.id}: reducer returned nothing; the branch results are concatenated instead`);
      result = concatenated();
    }
  } else {
    result = concatenated();
  }
  const done: DispatchResult = { id: spec.id, status: "done", result, artifacts: uniq([...artifacts, ...extraArtifacts]), iterations: 1 };
  return gapQuestion ? { ...done, question: gapQuestion } : done;
}

export const fanOut: TopologyImpl = {
  demand: (spec, params) => {
    const split = params["split"];
    const width = Array.isArray(split) ? split.length : int(params["width"], DEFAULT_WIDTH);
    if (width > MAX_WIDTH) return 0;
    const partition = typeof split === "string" ? 1 : 0;
    const reducer = params["reducer"] || (spec.roles ?? {})["reducer"] ? 1 : 0;
    return partition + width + reducer;
  },
  run: runFanOut,
};

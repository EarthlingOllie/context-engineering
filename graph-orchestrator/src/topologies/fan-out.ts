// ---------- fan-out ----------
import type { DispatchResult, DispatchSpec, DispatchStatus, FanOutParams, ReturnContract } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { DEFAULT_WIDTH, MAX_WIDTH, type TopologyContext, type TopologyImpl, blockedQuestion, callRole, contractOf, cutLines, fail, int, overBudget, readWorkOutput, roleEntry, strArr, uniq } from "./shared.ts";

type Branch = { index: number; task: string; status: DispatchStatus; result: string; artifacts: string[]; question?: string };

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
    const part = await callRole(
      ctx,
      spec,
      "worker",
      buildPrompt({
        role: "worker",
        task: `Partition this task into at most ${width} independent sub-tasks: ${spec.task}`,
        context: spec.context,
        entry: workerEntry,
        returns: { shape: "one imperative sentence per sub-task, each self-contained and non-overlapping", maxLines: width },
        artifactDir: ctx.artifactDir,
        sections: [{ title: "PARTITION INSTRUCTION", body: split }],
      }),
      "partition",
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
    if (!part) return fail(spec, "fan-out: partition agent returned nothing", 1);
    const pq = blockedQuestion(part);
    if (pq) return { id: spec.id, status: "blocked", result: "", artifacts: [], question: pq, iterations: 1 };
    subtasks = strArr(part, "subtasks").slice(0, width);
    if (subtasks.length === 0) return fail(spec, "fan-out: partition produced no sub-tasks", 1);
    if (strArr(part, "subtasks").length > width) ctx.rt.log(`${spec.id}: partition returned more than ${width} sub-tasks; extras dropped`);
  } else {
    return fail(spec, "fan-out: `params.split` must be a list of sub-tasks or a partition instruction");
  }

  // 2. Branches in parallel. Without a reducer the inline results are concatenated, so each gets a share of the lines.
  const n = subtasks.length;
  const branchReturns: ReturnContract = hasReducer ? returns : { shape: returns.shape, maxLines: Math.max(1, Math.floor(returns.maxLines / n)) };
  const raw = await ctx.rt.parallel(
    subtasks.map((task, i) => async (): Promise<Branch> => {
      const out = await callRole(
        ctx,
        spec,
        "worker",
        buildPrompt({
          role: "worker",
          task,
          context: [...spec.context, `this is branch ${i + 1} of ${n} of a fan-out whose parent task is: ${spec.task}`],
          entry: workerEntry,
          returns: branchReturns,
          artifactDir: ctx.artifactDir,
        }),
        `branch ${i + 1}/${n}`,
      );
      if (!out) return { index: i, task, status: "failed", result: "worker returned nothing", artifacts: [] };
      const { question, ...work } = readWorkOutput(out, branchReturns.maxLines);
      const b: Branch = { index: i, task, status: question ? "blocked" : "done", ...work };
      if (question) b.question = question;
      return b;
    }),
  );
  const branches: Branch[] = raw.map((b, i) => b ?? { index: i, task: subtasks[i] ?? "", status: "failed", result: "branch did not return", artifacts: [] });
  const finished = branches.filter((b) => b.status === "done");
  const blocked = branches.filter((b) => b.status === "blocked");
  const artifacts = uniq(branches.flatMap((b) => b.artifacts));
  const gapQuestion = blocked.length ? blocked.map((b) => `branch ${b.index + 1} (${b.task}): ${b.question}`).join("\n") : undefined;

  if (finished.length === 0) {
    const status: DispatchStatus = blocked.length ? "blocked" : "failed";
    const base = { id: spec.id, status, result: cutLines(branches.map((b) => `branch ${b.index + 1} ${b.status}: ${b.question ?? b.result}`).join("\n"), returns.maxLines), artifacts, iterations: 1 };
    return gapQuestion ? { ...base, question: gapQuestion } : base;
  }

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
      "reducer",
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

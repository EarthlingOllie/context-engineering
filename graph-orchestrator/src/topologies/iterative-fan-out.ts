// ---------- iterative-fan-out ----------
import type { DispatchResult, DispatchSpec, IterativeFanOutParams } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { type Branch, branchStep, noBranchFinished, partitionStep } from "./fan-out.ts";
import {
  DEFAULT_GAP_ROUNDS, DEFAULT_WIDTH, MAX_GAP_ROUNDS, MAX_WIDTH, type Checked, type TopologyContext, type TopologyImpl,
  blockedQuestion, callRole, contractOf, cutLines, fail, firstLine, int, overBudget, readWorkOutput, roleEntry, str, uniq,
} from "./shared.ts";

/** Iterative-fan-out params with the defaults applied; width is the list length for an explicit split. */
export type IterativeFanOutPlan = Required<IterativeFanOutParams>;

/** Branches per round: the list length for an explicit split, else params.width, else 3. */
function widthOf(params: Record<string, unknown>): number {
  const split = params["split"];
  return Array.isArray(split) ? split.filter((s) => typeof s === "string" && s.trim().length > 0).length : int(params["width"], DEFAULT_WIDTH, 0);
}

/**
 * The param check, before any agent is spent. Caps first (`over_budget`):
 * width or a split list above 9, max_rounds above 3. Then malformed
 * (`failed`): no split (empty list or blank instruction), width or max_rounds
 * below 1, no coverage_criteria.
 */
export function checkIterativeFanOut(spec: DispatchSpec): Checked<IterativeFanOutPlan> {
  const params = spec.params ?? {};
  const width = widthOf(params);
  if (width > MAX_WIDTH) return { ok: false, result: overBudget(spec, `iterative-fan-out: width ${width} exceeds the cap of ${MAX_WIDTH}`) };
  const max_rounds = int(params["max_rounds"], DEFAULT_GAP_ROUNDS, 0);
  if (max_rounds > MAX_GAP_ROUNDS) return { ok: false, result: overBudget(spec, `iterative-fan-out: ${max_rounds} rounds exceeds the cap of ${MAX_GAP_ROUNDS}`) };
  if (max_rounds < 1) return { ok: false, result: fail(spec, "iterative-fan-out: `max_rounds` must be at least 1") };
  const raw = params["split"];
  let split: string[] | string;
  if (Array.isArray(raw)) {
    split = raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    if (split.length === 0) return { ok: false, result: fail(spec, "iterative-fan-out: `split` list is empty") };
  } else if (typeof raw === "string" && raw.trim()) {
    split = raw;
    if (width < 1) return { ok: false, result: fail(spec, "iterative-fan-out: `width` must be at least 1") };
  } else return { ok: false, result: fail(spec, "iterative-fan-out: `split` must be a list of sub-tasks or a partition instruction") };
  const coverage_criteria = str(params, "coverage_criteria").trim();
  if (!coverage_criteria) return { ok: false, result: fail(spec, "iterative-fan-out: `coverage_criteria` is required") };
  return { ok: true, params: { split, width: Array.isArray(split) ? split.length : width, coverage_criteria, max_rounds } };
}

/** max_rounds × width + max_rounds (evaluator per round) + 1 (reducer), +1 for a partition instruction; 0 when a cap would refuse the spec. */
function demandIterativeFanOut(_spec: Partial<DispatchSpec>, params: Record<string, unknown>): number {
  const width = widthOf(params);
  const rounds = int(params["max_rounds"], DEFAULT_GAP_ROUNDS);
  if (width > MAX_WIDTH || rounds > MAX_GAP_ROUNDS) return 0;
  return rounds * width + rounds + 1 + (typeof params["split"] === "string" ? 1 : 0);
}

/** One branch from any round, as fan-out's branch step returned it; `index` is 1-based within its round. */
type Finding = Branch & { round: number };

/** Sub-task identity for dedup: trimmed, lowercased, whitespace collapsed. */
const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

/** Evaluator feedback as sub-tasks: one per non-empty line, list numbering or bullets stripped, deduplicated in order. */
function feedbackItems(feedback: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of feedback.split("\n")) {
    const t = line.replace(/^\s*(?:\d+[.)]|[-*\u2022])\s*/, "").trim();
    if (t && !seen.has(norm(t))) {
      seen.add(norm(t));
      items.push(t);
    }
  }
  return items;
}

/**
 * One round's branch step, reusing fan-out's partition and branch steps. Each
 * branch gets the dispatch's full return contract (the reducer merges them, as
 * in a fan-out with a reducer). Labels are `r<round> partition` and
 * `r<round> branch i/n` after the dispatch id. Returns the sub-tasks run and the
 * branches, or the result to return when the partition step stops the dispatch.
 */
async function branchRound(
  ctx: TopologyContext,
  spec: DispatchSpec,
  round: number,
  rounds: number,
  split: string[] | string,
  width: number,
): Promise<{ ok: true; tasks: string[]; branches: Branch[] } | { ok: false; result: DispatchResult }> {
  const workerEntry = roleEntry(spec, "worker");
  let tasks: string[];
  if (Array.isArray(split)) tasks = split;
  else {
    const part = await partitionStep(ctx, spec, split, width, { name: "iterative-fan-out", label: { role: "partition", round }, workerEntry });
    if (!part.ok) return part;
    tasks = part.subtasks;
  }
  const context = round === 1 ? spec.context : [...spec.context, `round ${round} of ${rounds} of an iterative fan-out: this sub-task fills a coverage gap the evaluator found`];
  const branches = await branchStep(ctx, spec, tasks, { branchReturns: contractOf(spec), workerEntry, context, label: (i, n, task) => ({ role: "worker", round, branch: i, branches: n, task }), kind: "an iterative fan-out round" });
  return { ok: true, tasks, branches };
}

/** Findings as section text: done branches with their result (or only its first line) and artifacts, the rest as GAP lines. */
function findingsText(findings: Finding[], full: boolean): string {
  return findings
    .map((f) => `round ${f.round} branch ${f.index} (${f.status}) — ${f.task}\n${f.status === "done" ? `${full ? f.result : firstLine(f.result)}\nartifacts: ${f.artifacts.length ? f.artifacts.join(", ") : "none"}` : `GAP: ${f.question ?? f.result}`}`)
    .join("\n\n");
}

async function runIterativeFanOut(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const checked = checkIterativeFanOut(spec);
  if (!checked.ok) return checked.result;
  const { width, coverage_criteria, max_rounds } = checked.params;
  const returns = contractOf(spec);
  const ran = new Set<string>();
  const findings: Finding[] = [];
  const artifacts = () => uniq(findings.flatMap((f) => f.artifacts));
  const gapQuestion = () => {
    const b = findings.filter((f) => f.status === "blocked");
    return b.length ? b.map((f) => `round ${f.round} branch ${f.index} (${f.task}): ${f.question}`).join("\n") : undefined;
  };
  const withGaps = (r: DispatchResult, q?: string): DispatchResult => {
    const gq = gapQuestion();
    const question = [q, gq].filter(Boolean).join("\n");
    return question ? { ...r, question } : r;
  };

  let split: string[] | string = checked.params.split;
  let round = 0;
  let openGaps: string[] = [];
  let passed = false;
  while (round < max_rounds) {
    round++;
    const step = await branchRound(ctx, spec, round, max_rounds, split, width);
    // Round 1 is fan-out's branch step outright: a failed partition, or every branch blocked or failed, ends the dispatch as fan-out ends it.
    if (!step.ok) return step.result;
    if (round === 1 && !step.branches.some((b) => b.status === "done")) return noBranchFinished(spec, step.branches, returns.maxLines);
    for (const t of step.tasks) ran.add(norm(t));
    findings.push(...step.branches.map((b): Finding => ({ ...b, round, index: b.index + 1 })));
    const body = findingsText(findings, false);
    const ev = await callRole(
      ctx,
      spec,
      "evaluator",
      buildPrompt({
        role: "evaluator",
        task: spec.task,
        context: spec.context,
        entry: roleEntry(spec, "evaluator"),
        returns: { shape: "pass, or one follow-up sub-task per feedback line for each gap in coverage", maxLines: 10 },
        artifactDir: ctx.artifactDir,
        sections: [
          { title: "COVERAGE CRITERIA", body: coverage_criteria },
          { title: "FINDINGS SO FAR", body },
        ],
      }),
      { role: "evaluator", round },
    );
    if (!ev) return { ...fail(spec, `iterative-fan-out: evaluator returned nothing in round ${round}`, round), artifacts: artifacts() };
    const eq = blockedQuestion(ev, "evaluator");
    if (eq) return withGaps({ id: spec.id, status: "blocked", result: `evaluator blocked in round ${round}`, artifacts: artifacts(), iterations: round }, eq);
    if (ev["pass"] === true) {
      passed = true;
      break;
    }
    openGaps = feedbackItems(str(ev, "feedback"));
    const fresh = openGaps.filter((t) => !ran.has(norm(t)));
    if (fresh.length === 0) {
      ctx.rt.log(`${spec.id}: stalled after round ${round}; the evaluator named no new sub-task`);
      break;
    }
    if (round === max_rounds) break;
    if (fresh.length > width) ctx.rt.log(`${spec.id}: round ${round + 1} keeps ${width} of ${fresh.length} gap sub-tasks; dropped: ${fresh.slice(width).join("; ")}`);
    split = fresh.slice(0, width);
  }

  // Reduce: always, over every branch of every round, noting the gaps; with the evaluator's open gaps when exhausted.
  const sections = [{ title: "BRANCH RESULTS", body: findingsText(findings, true) }];
  if (!passed) sections.push({ title: "OPEN GAPS", body: openGaps.length ? openGaps.map((g) => `- ${g}`).join("\n") : "(the evaluator named none)" });
  const red = await callRole(
    ctx,
    spec,
    "reducer",
    buildPrompt({ role: "reducer", task: spec.task, context: spec.context, entry: roleEntry(spec, "reducer"), returns, artifactDir: ctx.artifactDir, sections }),
    { role: "reducer" },
  );
  if (!red) return { ...fail(spec, "iterative-fan-out: reducer returned nothing", round), artifacts: artifacts() };
  const { question: rq, ...work } = readWorkOutput(red, returns.maxLines);
  if (rq) return withGaps({ id: spec.id, status: "blocked", result: work.result, artifacts: artifacts(), iterations: round }, rq);
  const all = uniq([...artifacts(), ...work.artifacts]);
  if (passed) return withGaps({ id: spec.id, status: "done", result: work.result, artifacts: all, iterations: round });
  const tail = `-- exhausted after ${round} round(s); open gaps: ${openGaps.length}; first: ${openGaps[0] ?? "none"}`;
  const result = `${cutLines(work.result, Math.max(0, returns.maxLines - 1))}\n${tail}`.replace(/^\n/, "");
  return withGaps({ id: spec.id, status: "exhausted", result, artifacts: all, iterations: round });
}

export const iterativeFanOut: TopologyImpl = { demand: demandIterativeFanOut, run: runIterativeFanOut };

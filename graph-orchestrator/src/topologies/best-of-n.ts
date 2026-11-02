// ---------- best-of-n ----------
import type { BestOfNParams, DispatchResult, DispatchSpec } from "../types.ts";
import { ROLE_SCHEMAS, buildPrompt } from "../roles.ts";
import {
  DEFAULT_WIDTH,
  MAX_WIDTH,
  type Checked,
  type TopologyContext,
  type TopologyImpl,
  type WorkOutput,
  blockedQuestion,
  callRole,
  contractOf,
  cutLines,
  fail,
  firstLine,
  int,
  overBudget,
  readWorkOutput,
  roleEntry,
  str,
  strArr,
  uniq,
} from "./shared.ts";

/** Best-of-n params with the defaults applied; `variants` is [] when none were given. */
export type BestOfNPlan = Required<BestOfNParams>;

/** n: variants.length when variants are given, else params.n, else 3. */
function attempts(params: Record<string, unknown>): number {
  const v = params["variants"];
  return Array.isArray(v) ? v.length : int(params["n"], DEFAULT_WIDTH, 0);
}

/**
 * The param check, before any agent is spent. Cap first (`over_budget`): n
 * above 9. Then malformed (`failed`): n below 2, variants that are not
 * non-empty strings, an explicit n that disagrees with variants, no criteria,
 * a mode other than "select" or "vote".
 */
export function checkBestOfN(spec: DispatchSpec): Checked<BestOfNPlan> {
  const params = spec.params ?? {};
  const n = attempts(params);
  if (n > MAX_WIDTH) return { ok: false, result: overBudget(spec, `best-of-n: ${n} attempts exceeds the width cap of ${MAX_WIDTH}`) };
  if (n < 2) return { ok: false, result: fail(spec, "best-of-n: `n` must be at least 2") };
  const v = params["variants"];
  let variants: string[] = [];
  if (v !== undefined) {
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.trim())) return { ok: false, result: fail(spec, "best-of-n: `variants` must be a list of non-empty strings") };
    variants = v.map((x: string) => x.trim());
    if (params["n"] !== undefined && int(params["n"], n, 0) !== n) return { ok: false, result: fail(spec, `best-of-n: n ${String(params["n"])} disagrees with ${n} variants`) };
  }
  const criteria = str(params, "criteria").trim();
  if (!criteria) return { ok: false, result: fail(spec, "best-of-n: `criteria` is required") };
  const m = params["mode"] ?? "select";
  if (m !== "select" && m !== "vote") return { ok: false, result: fail(spec, `best-of-n: mode "${String(m)}" is not "select" or "vote"`) };
  return { ok: true, params: { n, variants, criteria, mode: m } };
}

/** n + 1 (the judge; in vote mode an upper bound, as the judge runs only without a majority); 0 when a cap would refuse the spec. */
function demandBestOfN(_spec: Partial<DispatchSpec>, params: Record<string, unknown>): number {
  const n = attempts(params);
  if (n > MAX_WIDTH) return 0;
  return n + 1;
}

/** One attempt's outcome; `index` is 1-based, as the prompts and the judge name it. */
type Attempt = { index: number } & ({ kind: "done"; work: WorkOutput } | { kind: "blocked"; question: string } | { kind: "empty" });

/** The judge schema plus the chosen candidate's index, so the winner's artifacts can go first. */
const JUDGE_SCHEMA = (() => {
  const base = ROLE_SCHEMAS.judge as { properties: Record<string, unknown>; required: string[] };
  return {
    ...base,
    properties: { ...base.properties, chosen: { type: "integer", description: "The [i] index of the chosen candidate." } },
    required: [...base.required, "chosen"],
  };
})();

/** Vote-mode key: the first line, trimmed, lowercased, whitespace collapsed. */
function voteKey(result: string): string {
  return firstLine(result).trim().toLowerCase().replace(/\s+/g, " ");
}

/** The winner's artifacts first, then every other candidate's in attempt order. */
function orderedArtifacts(done: Array<{ index: number; work: WorkOutput }>, winner: number | undefined): string[] {
  const w = done.find((d) => d.index === winner);
  return uniq([...(w ? w.work.artifacts : []), ...done.filter((d) => d !== w).flatMap((d) => d.work.artifacts)]);
}

/**
 * n workers in parallel (each told its attempt, approach and a candidate dir
 * of its own); blocked or empty attempts drop out. Vote mode returns a strict
 * majority (> n/2 of the first lines) with no judge; otherwise the judge picks
 * from the candidates.
 */
async function runBestOfN(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const checked = checkBestOfN(spec);
  if (!checked.ok) return checked.result;
  const { n, variants, criteria, mode } = checked.params;
  const returns = contractOf(spec);
  const workerEntry = roleEntry(spec, "worker");

  // 1. Attempts in parallel, each isolated in its own candidate dir.
  const raw = await ctx.rt.parallel(
    Array.from({ length: n }, (_, k) => async (): Promise<Attempt> => {
      const index = k + 1;
      const sections = [
        { title: `ATTEMPT ${index} of ${n}`, body: "one independent attempt at the task; the attempts are compared against the CRITERIA below" },
        ...(variants.length ? [{ title: "APPROACH", body: variants[k]! }] : []),
        { title: "CRITERIA", body: criteria },
        { title: "CANDIDATE DIR", body: `write your candidate under ${ctx.artifactDir}/${spec.id}-c${index}/ ; do not modify the working tree` },
      ];
      const label = `attempt ${index}/${n}`;
      const out = await callRole(
        ctx,
        spec,
        "worker",
        buildPrompt({ role: "worker", task: spec.task, context: spec.context, entry: workerEntry, returns, artifactDir: ctx.artifactDir, sections }),
        label,
      );
      if (!out) {
        ctx.rt.log(`${spec.id} ${label} returned nothing; dropped`);
        return { index, kind: "empty" };
      }
      const { question, ...work } = readWorkOutput(out, returns.maxLines);
      return question ? { index, kind: "blocked", question } : { index, kind: "done", work };
    }),
  );
  const all: Attempt[] = raw.map((a, k) => a ?? { index: k + 1, kind: "empty" });
  const done = all.flatMap((a) => (a.kind === "done" ? [{ index: a.index, work: a.work }] : []));
  const blocked = all.flatMap((a) => (a.kind === "blocked" ? [{ index: a.index, question: a.question }] : []));
  const question = blocked.length ? blocked.map((b) => `attempt ${b.index}: ${b.question}`).join("\n") : undefined;
  const withQuestion = (r: DispatchResult): DispatchResult => (question && !r.question ? { ...r, question } : r);

  // 2. Every attempt dropped out.
  if (done.length === 0) {
    const notes = all.map((a) => `attempt ${a.index} ${a.kind === "blocked" ? `blocked: ${a.question}` : "returned nothing"}`).join("\n");
    return withQuestion({ id: spec.id, status: blocked.length ? "blocked" : "failed", result: cutLines(notes, returns.maxLines), artifacts: [], iterations: 1 });
  }

  // 3. Vote: a strict majority of n wins with no judge.
  if (mode === "vote") {
    const tally = new Map<string, number>();
    // An empty first line is no vote: it cannot form a majority on its own.
    for (const d of done) {
      const k = voteKey(d.work.result);
      if (k) tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    const top = [...tally.entries()].find(([, c]) => c > n / 2);
    if (top) {
      const winner = done.find((d) => voteKey(d.work.result) === top[0])!;
      return withQuestion({ id: spec.id, status: "done", result: winner.work.result, artifacts: orderedArtifacts(done, winner.index), iterations: 1 });
    }
    ctx.rt.log(`${spec.id}: no strict majority among ${done.length} vote(s) of ${n}; the judge decides`);
  }

  // 4. Judge.
  const candidates = done.map((d) => `[${d.index}] ${d.work.result}\nartifacts: ${d.work.artifacts.length ? d.work.artifacts.join(", ") : "none"}`).join("\n\n");
  const dropped = all.filter((a) => a.kind !== "done");
  const sections = [
    { title: "CRITERIA", body: criteria },
    { title: "CANDIDATES", body: candidates },
    ...(dropped.length ? [{ title: "BLOCKED ATTEMPTS", body: dropped.map((a) => `- attempt ${a.index} ${a.kind === "blocked" ? `blocked: ${a.question}` : "returned nothing"}`).join("\n") }] : []),
    { title: "CHOICE", body: "the verdict must name the chosen candidate by its [i] index; also set `chosen` to that index" },
  ];
  const candidateArtifacts = orderedArtifacts(done, undefined);
  const j = await callRole(
    ctx,
    spec,
    "judge",
    buildPrompt({ role: "judge", task: spec.task, context: spec.context, entry: roleEntry(spec, "judge"), returns, artifactDir: ctx.artifactDir, sections }),
    "judge",
    JUDGE_SCHEMA,
  );
  if (!j) return withQuestion({ ...fail(spec, "best-of-n: judge returned nothing", 1), artifacts: candidateArtifacts });
  const verdict = cutLines(str(j, "verdict"), returns.maxLines);
  const jq = blockedQuestion(j, "judge");
  if (jq) return { id: spec.id, status: "blocked", result: verdict, artifacts: candidateArtifacts, question: question ? `${jq}\n${question}` : jq, iterations: 1 };
  if (!verdict.trim()) return withQuestion({ ...fail(spec, "best-of-n: judge returned nothing", 1), artifacts: candidateArtifacts });
  const ids = new Set(done.map((d) => d.index));
  const named = Number(j["chosen"]);
  const fromVerdict = Number(/\[(\d+)\]/.exec(verdict)?.[1]);
  const winner = ids.has(named) ? named : ids.has(fromVerdict) ? fromVerdict : undefined;
  if (winner === undefined) ctx.rt.log(`${spec.id}: judge named no valid candidate index; artifacts kept in attempt order`);
  return withQuestion({ id: spec.id, status: "done", result: verdict, artifacts: uniq([...orderedArtifacts(done, winner), ...strArr(j, "artifacts")]), iterations: 1 });
}

export const bestOfN: TopologyImpl = { demand: demandBestOfN, run: runBestOfN };

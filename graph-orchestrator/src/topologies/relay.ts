// ---------- relay ----------
import type { DispatchResult, DispatchSpec, RelayParams } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { DEFAULT_SESSIONS, MAX_SESSIONS, type Checked, type TopologyContext, type TopologyImpl, type WorkOutput, blockedQuestion, callRole, contractOf, cutLines, fail, firstLine, int, overBudget, readWorkOutput, roleEntry, str, uniq } from "./shared.ts";

/** Relay params with the defaults applied. */
export type RelayPlan = Required<RelayParams>;

/**
 * The param check, before any agent is spent. Cap first (`over_budget`):
 * max_sessions above 10. Then malformed (`failed`): no done_criteria, no
 * progress path, max_sessions or check_every below 1.
 */
export function checkRelay(spec: DispatchSpec): Checked<RelayPlan> {
  const params = spec.params ?? {};
  const max_sessions = int(params["max_sessions"], DEFAULT_SESSIONS, 0);
  if (max_sessions > MAX_SESSIONS) return { ok: false, result: overBudget(spec, `relay: ${max_sessions} sessions exceeds the cap of ${MAX_SESSIONS}`) };
  if (max_sessions < 1) return { ok: false, result: fail(spec, "relay: `max_sessions` must be at least 1") };
  const check_every = int(params["check_every"], 1, 0);
  if (check_every < 1) return { ok: false, result: fail(spec, "relay: `check_every` must be at least 1") };
  const done_criteria = str(params, "done_criteria").trim();
  if (!done_criteria) return { ok: false, result: fail(spec, "relay: `done_criteria` is required; the done-check is the only stop") };
  const progress = str(params, "progress").trim();
  if (!progress) return { ok: false, result: fail(spec, "relay: `progress` (the progress-artifact path) is required") };
  return { ok: true, params: { done_criteria, progress, max_sessions, check_every } };
}

/** max_sessions + ceil(max_sessions / check_every) (an upper bound: the loop stops early); 0 when a cap would refuse the spec. */
function demandRelay(_spec: Partial<DispatchSpec>, params: Record<string, unknown>): number {
  const sessions = int(params["max_sessions"], DEFAULT_SESSIONS);
  if (sessions > MAX_SESSIONS) return 0;
  return sessions + Math.ceil(sessions / int(params["check_every"], 1));
}

/**
 * The relay loop: one worker session per increment, each starting fresh from
 * the progress file, the done criteria, the artifact paths so far and the last
 * check's feedback (no prior inline result). The evaluator done-check runs
 * every `check_every` sessions and always after the last; a pass is the only
 * way to `done`.
 */
async function runRelay(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const checked = checkRelay(spec);
  if (!checked.ok) return checked.result;
  const { done_criteria, progress, max_sessions: n, check_every } = checked.params;
  const returns = contractOf(spec);
  const workerEntry = roleEntry(spec, "worker");
  const evalEntry = roleEntry(spec, "evaluator");

  let artifacts: string[] = [];
  let feedback: string | null = null;
  let last: WorkOutput | null = null;

  for (let s = 1; s <= n; s++) {
    const sections: Array<{ title: string; body: string }> = [
      { title: `SESSION ${s} of ${n}`, body: "Make the next increment only; read PROGRESS first; rewrite it before you report." },
      { title: `PROGRESS: ${progress}`, body: "The progress artifact: the only state carried between sessions besides the files below." },
      { title: "DONE CRITERIA", body: done_criteria },
      { title: "ARTIFACTS SO FAR", body: artifacts.length ? artifacts.join("\n") : "none" },
    ];
    if (feedback !== null) sections.push({ title: "LAST CHECK FEEDBACK", body: feedback || "(no feedback given)" });
    const out = await callRole(
      ctx,
      spec,
      "worker",
      buildPrompt({ role: "worker", task: spec.task, context: spec.context, entry: workerEntry, returns, artifactDir: ctx.artifactDir, sections }),
      { role: "worker", index: s, count: n },
    );
    if (!out) return { ...fail(spec, `relay: worker returned nothing in session ${s}`, s), artifacts };
    const { question: wq, ...work } = readWorkOutput(out, returns.maxLines);
    last = work;
    artifacts = uniq([...artifacts, ...work.artifacts]);
    if (wq) return { id: spec.id, status: "blocked", result: work.result, artifacts, question: wq, iterations: s };

    if (s % check_every !== 0 && s !== n) continue;
    const ev = await callRole(
      ctx,
      spec,
      "evaluator",
      buildPrompt({
        role: "evaluator",
        task: spec.task,
        context: spec.context,
        entry: evalEntry,
        returns: { shape: "pass or fail with numbered feedback", maxLines: 10 },
        artifactDir: ctx.artifactDir,
        sections: [
          { title: "DONE CRITERIA", body: done_criteria },
          { title: `SUBMISSION (session ${s} of ${n})`, body: `${work.result}\nartifacts: ${artifacts.length ? artifacts.join(", ") : "none"}\nprogress: ${progress}` },
        ],
      }),
      { role: "evaluator", index: Math.ceil(s / check_every), count: Math.ceil(n / check_every) },
    );
    if (!ev) return { ...fail(spec, `relay: evaluator returned nothing in session ${s}`, s), artifacts };
    const eq = blockedQuestion(ev);
    if (eq) return { id: spec.id, status: "blocked", result: work.result, artifacts, question: eq, iterations: s };
    if (ev["pass"] === true) return { id: spec.id, status: "done", result: work.result, artifacts, iterations: s };
    feedback = str(ev, "feedback");
  }

  // The check line always survives the cut: the result gives up its last line for it.
  const tail = `-- exhausted after ${n} session(s); last check: ${firstLine(feedback ?? "")}`;
  const head = returns.maxLines > 1 ? cutLines(last?.result ?? "", returns.maxLines - 1) : "";
  return { id: spec.id, status: "exhausted", result: head ? `${head}\n${tail}` : tail, artifacts, iterations: n };
}

export const relay: TopologyImpl = { demand: demandRelay, run: runRelay };

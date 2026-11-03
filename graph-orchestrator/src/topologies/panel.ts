// ---------- panel ----------
import type { DispatchResult, DispatchSpec, PanelLens, PanelParams, RoleEntry } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { MAX_PARTICIPANTS, type Checked, type TopologyContext, type TopologyImpl, blockedQuestion, callRole, entryOf, contractOf, cutLines, fail, firstLine, overBudget, readWorkOutput, roleEntry, str } from "./shared.ts";

/** Panel params with the defaults applied and the reducer resolved (roles.reducer, params.reducer entry, or `true`; null when none). */
export type PanelPlan = { lenses: PanelLens[]; pass_criteria: string; pool: "all" | "majority"; reducer: RoleEntry | true | null };

/**
 * The param check, before any agent is spent. Cap first (`over_budget`): more
 * than 6 lenses. Then malformed (`failed`): no lenses, a lens without a name or
 * focus, a duplicate name, no pass_criteria, a pool other than "all" or
 * "majority".
 */
export function checkPanel(spec: DispatchSpec): Checked<PanelPlan> {
  const params = spec.params ?? {};
  const raw = params["lenses"];
  if (Array.isArray(raw) && raw.length > MAX_PARTICIPANTS) return { ok: false, result: overBudget(spec, `panel: ${raw.length} lenses exceeds the cap of ${MAX_PARTICIPANTS}`) };
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, result: fail(spec, "panel: `lenses` must list 1 to 6 { name, focus } entries") };
  const lenses: PanelLens[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const name = str(o, "name").trim();
    const focus = str(o, "focus").trim();
    if (!name || !focus) return { ok: false, result: fail(spec, "panel: every lens needs a non-empty `name` and `focus`") };
    if (seen.has(name)) return { ok: false, result: fail(spec, `panel: duplicate lens name "${name}"`) };
    seen.add(name);
    const skill = str(o, "skill").trim();
    lenses.push(skill ? { name, focus, skill } : { name, focus });
  }
  const pass_criteria = str(params, "pass_criteria").trim();
  if (!pass_criteria) return { ok: false, result: fail(spec, "panel: `pass_criteria` is required") };
  const pool = params["pool"] ?? "all";
  if (pool !== "all" && pool !== "majority") return { ok: false, result: fail(spec, `panel: pool "${String(pool)}" is not "all" or "majority"`) };
  const pr = (params as Partial<PanelParams>).reducer;
  const reducer = roleEntry(spec, "reducer") ?? entryOf(pr) ?? (pr === true ? true : null);
  return { ok: true, params: { lenses, pass_criteria, pool, reducer } };
}

/** k lenses (+1 with a reducer); 0 when a cap would refuse the spec. */
function demandPanel(spec: Partial<DispatchSpec>, params: Record<string, unknown>): number {
  const raw = params["lenses"];
  const k = Array.isArray(raw) ? raw.length : 0;
  if (k > MAX_PARTICIPANTS) return 0;
  const roles = spec.roles && typeof spec.roles === "object" ? spec.roles : {};
  const hasReducer = Boolean(roles["reducer"]) || Boolean(params["reducer"]);
  return k + (hasReducer ? 1 : 0);
}

/** One lens's verdict as the evaluator returned it. */
type LensVerdict = { lens: PanelLens; pass: boolean; feedback: string; question?: string } | { lens: PanelLens; missing: true };

/**
 * k evaluators in parallel, one per lens; any blocked lens blocks the panel,
 * any lens that returned nothing fails it. Code pools the verdicts ("all", or
 * "majority" = strictly more than k/2 passes). Without a reducer the result is
 * the verdict line plus `[name] FAIL: <first feedback line>` per failing lens;
 * with one, the verdict line plus the reducer's result and artifacts.
 */
async function runPanel(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const checked = checkPanel(spec);
  if (!checked.ok) return checked.result;
  const { lenses, pass_criteria, pool, reducer } = checked.params;
  const returns = contractOf(spec);
  const evalEntry = roleEntry(spec, "evaluator");
  const k = lenses.length;

  const raw = await ctx.rt.parallel(
    lenses.map((lens, li) => async (): Promise<LensVerdict> => {
      const skill = lens.skill ?? evalEntry?.skill;
      const entry: RoleEntry = { ...(skill ? { skill } : {}), instructions: evalEntry?.instructions ?? "" };
      const out = await callRole(
        ctx,
        spec,
        "evaluator",
        buildPrompt({
          role: "evaluator",
          task: spec.task,
          context: spec.context,
          entry,
          returns: { shape: "pass or fail with numbered feedback", maxLines: 10 },
          artifactDir: ctx.artifactDir,
          sections: [
            { title: `LENS: ${lens.name} — ${lens.focus}`, body: `judge only this lens; one of ${k} independent reviewers, each with its own lens.` },
            { title: "PASS CRITERIA (judged through this lens only)", body: pass_criteria },
            { title: "SUBMISSION", body: `the artifact(s) named in CONTEXT, produced for: ${spec.task}` },
          ],
        }),
        { role: "evaluator", name: lens.name, index: li + 1, count: k },
      );
      if (!out) return { lens, missing: true };
      const q = blockedQuestion(out, "evaluator");
      const v: LensVerdict = { lens, pass: out["pass"] === true, feedback: str(out, "feedback").trim() };
      if (q) v.question = q;
      return v;
    }),
  );
  const verdicts: LensVerdict[] = raw.map((v, i) => v ?? { lens: lenses[i]!, missing: true });

  const blocked = verdicts.filter((v): v is Extract<LensVerdict, { pass: boolean }> => !("missing" in v) && v.question !== undefined);
  if (blocked.length) {
    return { id: spec.id, status: "blocked", result: `lens(es) ${blocked.map((v) => v.lens.name).join(", ")} blocked`, artifacts: [], question: blocked.map((v) => `lens ${v.lens.name}: ${v.question}`).join("\n"), iterations: 1 };
  }
  const missing = verdicts.filter((v) => "missing" in v);
  if (missing.length) return fail(spec, `panel: evaluator returned nothing for lens(es): ${missing.map((v) => v.lens.name).join(", ")}`, 1);

  const judged = verdicts as Array<Extract<LensVerdict, { pass: boolean }>>;
  const p = judged.filter((v) => v.pass).length;
  const passed = pool === "all" ? p === k : p > k / 2;
  const verdict = passed ? "PASS" : `FAIL (${p}/${k})`;
  const failing = judged.filter((v) => !v.pass);

  if (reducer === null) {
    const lines = [verdict, ...failing.map((v) => `[${v.lens.name}] FAIL: ${firstLine(v.feedback) || "(no feedback given)"}`)];
    return { id: spec.id, status: "done", result: cutLines(lines.join("\n"), returns.maxLines), artifacts: [], iterations: 1 };
  }

  const body = judged.map((v) => `[${v.lens.name}] ${v.pass ? "PASS" : "FAIL"}${v.feedback ? `\n${v.feedback}` : ""}`).join("\n\n");
  const redReturns = { shape: returns.shape, maxLines: Math.max(1, returns.maxLines - 1) };
  const red = await callRole(
    ctx,
    spec,
    "reducer",
    buildPrompt({
      role: "reducer",
      task: spec.task,
      context: spec.context,
      entry: reducer === true ? undefined : reducer,
      returns: redReturns,
      artifactDir: ctx.artifactDir,
      sections: [
        { title: "VERDICT", body: `${verdict}\n(pooled by code, rule "${pool}"; it is fixed: your result goes under it. Write the merged, deduplicated feedback to an artifact.)` },
        { title: "PASS CRITERIA", body: pass_criteria },
        { title: "LENS FEEDBACK", body },
      ],
    }),
    { role: "reducer" },
  );
  if (!red) return fail(spec, `panel: reducer returned nothing; pooled verdict was ${verdict}`, 1);
  const { question, ...work } = readWorkOutput(red, redReturns.maxLines);
  if (question) return { id: spec.id, status: "blocked", result: verdict, artifacts: work.artifacts, question, iterations: 1 };
  const result = cutLines(work.result ? `${verdict}\n${work.result}` : verdict, returns.maxLines);
  return { id: spec.id, status: "done", result, artifacts: work.artifacts, iterations: 1 };
}

export const panel: TopologyImpl = { demand: demandPanel, run: runPanel };

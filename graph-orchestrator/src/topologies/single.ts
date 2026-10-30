// ---------- single ----------
import type { DispatchResult, DispatchSpec } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { type TopologyContext, type TopologyImpl, blockedQuestion, callRole, contractOf, cutLines, fail, roleEntry, str, strArr } from "./shared.ts";

async function runSingle(ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const returns = contractOf(spec);
  const out = await callRole(
    ctx,
    spec,
    "worker",
    buildPrompt({ role: "worker", task: spec.task, context: spec.context, entry: roleEntry(spec, "worker"), returns, artifactDir: ctx.artifactDir }),
    "worker",
  );
  if (!out) return fail(spec, "worker returned nothing", 1);
  const q = blockedQuestion(out);
  const base = { id: spec.id, result: cutLines(str(out, "result"), returns.maxLines), artifacts: strArr(out, "artifacts"), iterations: 1 };
  return q ? { ...base, status: "blocked", question: q } : { ...base, status: "done" };
}

export const single: TopologyImpl = { demand: () => 1, run: runSingle };

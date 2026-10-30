// ---------- single ----------
import type { DispatchResult, DispatchSpec } from "../types.ts";
import { buildPrompt } from "../roles.ts";
import { type TopologyContext, type TopologyImpl, callRole, contractOf, fail, readWorkOutput, roleEntry } from "./shared.ts";

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
  const { question, ...work } = readWorkOutput(out, returns.maxLines);
  const base = { id: spec.id, ...work, iterations: 1 };
  return question ? { ...base, status: "blocked", question } : { ...base, status: "done" };
}

export const single: TopologyImpl = { demand: () => 1, run: runSingle };

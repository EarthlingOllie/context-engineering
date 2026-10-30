// ---------- debate ----------
import type { DispatchResult, DispatchSpec } from "../types.ts";
import { MAX_PARTICIPANTS, type TopologyContext, fail, overBudget } from "./shared.ts";

/**
 * Deliberately not built here. Spec story 42: the first real task run through
 * the orchestrator is building the debate topology itself, so that the design
 * is proven by use. The signature, caps, roles (judge, debater) and the
 * catalog entry are in place; this function is what the dogfood task replaces.
 */
export async function runDebate(_ctx: TopologyContext, spec: DispatchSpec): Promise<DispatchResult> {
  const params = spec.params ?? {};
  const p = params["participants"];
  if (Array.isArray(p) && p.length > MAX_PARTICIPANTS) return overBudget(spec, `debate: ${p.length} participants exceeds the cap of ${MAX_PARTICIPANTS}`);
  return fail(spec, "debate is not built in this plugin version: it is the dogfood task (spec story 42). Use generator-evaluator or a fan-out with a reducer for now.");
}

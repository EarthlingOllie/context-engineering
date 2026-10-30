/**
 * The dispatch seam: the agent demand of a spec and the run of one spec,
 * each choosing by `spec.topology`. Nothing in here throws for a bad spec; it
 * returns `failed` so a wave always comes back whole.
 */
import type { DispatchResult, DispatchSpec } from "../types.ts";
import { TOPOLOGIES } from "../types.ts";
import { DEFAULT_ITERATIONS, DEFAULT_ROUNDS, DEFAULT_WIDTH, MAX_PARTICIPANTS, MAX_WIDTH, type TopologyContext, contractOf, fail, int } from "./shared.ts";
import { runSingle } from "./single.ts";
import { runGeneratorEvaluator } from "./generator-evaluator.ts";
import { runFanOut } from "./fan-out.ts";
import { runDebate } from "./debate.ts";
import { runChain } from "./chain.ts";

// ---------- agent demand ----------

/**
 * Upper bound on the agents a dispatch may spawn. Logged against the cap, and
 * summed for the run limit. A spec a cap refuses (`over_budget`) spends nothing,
 * so it counts 0.
 */
export function agentDemand(raw: Partial<DispatchSpec> | null | undefined): number {
  const spec: Partial<DispatchSpec> = raw && typeof raw === "object" ? raw : {};
  const params = (spec.params && typeof spec.params === "object" ? spec.params : {}) as Record<string, unknown>;
  switch (spec.topology) {
    case "single":
      return 1;
    case "generator-evaluator":
      return 2 * int(params["max_iterations"], DEFAULT_ITERATIONS);
    case "fan-out": {
      const split = params["split"];
      const width = Array.isArray(split) ? split.length : int(params["width"], DEFAULT_WIDTH);
      if (width > MAX_WIDTH) return 0;
      const partition = typeof split === "string" ? 1 : 0;
      const reducer = params["reducer"] || (spec.roles ?? {})["reducer"] ? 1 : 0;
      return partition + width + reducer;
    }
    case "debate": {
      const p = params["participants"];
      const n = Array.isArray(p) ? p.length : 0;
      if (n > MAX_PARTICIPANTS) return 0;
      return n * int(params["rounds"], DEFAULT_ROUNDS) + 1;
    }
    case "chain": {
      const stages = params["stages"];
      return Array.isArray(stages) ? stages.reduce((s: number, st) => s + agentDemand(st as DispatchSpec), 0) : 0;
    }
    default:
      return 0;
  }
}

/** Run one dispatch spec. Never throws: a spec that cannot run returns `failed`. */
export async function runDispatch(ctx: TopologyContext, raw: DispatchSpec): Promise<DispatchResult> {
  if (!raw || typeof raw !== "object") return fail({ id: "?" }, "dispatch spec is not an object");
  if (typeof raw.id !== "string" || !raw.id) return fail({ id: "?" }, "dispatch spec has no id");
  if (!TOPOLOGIES.includes(raw.topology)) return fail(raw, `unknown topology "${String(raw.topology)}"; valid: ${TOPOLOGIES.join(", ")}`);
  const spec: DispatchSpec = {
    ...raw,
    task: typeof raw.task === "string" ? raw.task : "",
    context: Array.isArray(raw.context) ? raw.context.map(String) : [],
    roles: raw.roles && typeof raw.roles === "object" ? raw.roles : {},
    params: raw.params && typeof raw.params === "object" ? raw.params : {},
    returns: contractOf(raw),
    dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
  };
  if (!spec.task) return fail(spec, "dispatch spec has no task");
  try {
    switch (spec.topology) {
      case "single":
        return await runSingle(ctx, spec);
      case "generator-evaluator":
        return await runGeneratorEvaluator(ctx, spec);
      case "fan-out":
        return await runFanOut(ctx, spec);
      case "debate":
        return await runDebate(ctx, spec);
      case "chain":
        return await runChain(ctx, spec);
    }
  } catch (err) {
    return fail(spec, `topology threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

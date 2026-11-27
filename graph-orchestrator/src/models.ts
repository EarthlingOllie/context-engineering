/**
 * Per-role models (ticket 07, COST-01 and COST-02a). Mechanical roles do not
 * need the session model: the scribe copies lines into a file and the partition
 * step splits a task into sentences, so both default to Haiku. Every other role
 * gets no model and runs on the session model. A dispatch spec overrides any
 * role, default or not, with `roles.<role>.model` (for a reducer or judge given
 * in params, `params.reducer.model` / `params.judge.model`); that is how an
 * evaluator, reducer or judge is opted into Sonnet.
 *
 * An unknown model makes `agent()` return null rather than throw (spike A-01),
 * so a bad override surfaces as the role's ordinary "returned nothing" failure.
 */
import type { DispatchSpec } from "./types.ts";
import type { LabelRole } from "./labels.ts";

/** The model each role runs on when the spec names none; a role absent here runs on the session model. */
export const ROLE_MODEL_DEFAULTS: Partial<Record<LabelRole, string>> = { scribe: "haiku", partition: "haiku" };

/** A non-blank model string, else undefined (the spec is JSON: anything may be there). */
function modelOf(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = (raw as { model?: unknown }).model;
  return typeof m === "string" && m.trim() ? m.trim() : undefined;
}

/** The model a role's agent call carries for this spec: the spec's override, else the role's default, else none. */
export function roleModel(spec: Partial<DispatchSpec> | null | undefined, role: LabelRole): string | undefined {
  const roles = spec?.roles && typeof spec.roles === "object" ? (spec.roles as Record<string, unknown>) : {};
  const params = spec?.params && typeof spec.params === "object" ? (spec.params as Record<string, unknown>) : {};
  return modelOf(roles[role]) ?? (role === "reducer" || role === "judge" ? modelOf(params[role]) : undefined) ?? ROLE_MODEL_DEFAULTS[role];
}

/** `{ model }` for a role that has one, `{}` otherwise, so a role without a model carries no `model` key at all. */
export function modelOpt(spec: Partial<DispatchSpec> | null | undefined, role: LabelRole): { model?: string } {
  const model = roleModel(spec, role);
  return model ? { model } : {};
}

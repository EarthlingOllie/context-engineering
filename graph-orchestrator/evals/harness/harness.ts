/**
 * Loads the built dispatch bundle the way the Workflow harness does (the
 * `export const meta` literal read on its own, the rest run as the body of an
 * async function over the harness globals) and runs one dispatch on the real
 * Runtime. The result is the data the Inspect task reads: the dispatch's
 * return value, per-agent timings, labels and queue time, and the log.
 *
 * The plugin is not changed: the bundle is read as text and run as is.
 */
import { createRuntime, type AgentRecord, type Engine, type LogRecord } from "./runtime.ts";
import type { Runtime } from "../../src/types.ts";

export type Bundle = { meta: Record<string, unknown>; run: (rt: Runtime, args: unknown) => Promise<unknown> };

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...a: string[]) => (...b: unknown[]) => Promise<unknown>;

export function loadBundle(src: string): Bundle {
  if (!src.startsWith("export const meta = {")) throw new Error("bundle does not begin with the meta literal");
  const end = src.indexOf("\n}\n");
  const meta = new Function(`return (${src.slice("export const meta = ".length, end + 2)});`)() as Record<string, unknown>;
  const body = src.slice(end + 3);
  const fn = new AsyncFunction("agent", "parallel", "log", "phase", "pipeline", "workflow", "budget", "args", body);
  const unsupported = (name: string) => () => {
    throw new Error(`${name}() is not supported by the eval harness`);
  };
  return {
    meta,
    run: (rt, args) => fn(rt.agent, rt.parallel, rt.log, () => {}, unsupported("pipeline"), unsupported("workflow"), rt.budget ?? { total: null }, args),
  };
}

export type HarnessResult = {
  meta: { name: unknown };
  mainModel: string;
  /** Roles the harness forced onto another model (role -> model id); empty in the baseline. */
  roleModels: Record<string, string>;
  cap: number;
  /** Files hashed before and after every agent (AgentRecord.watched). */
  watch: string[];
  wallClockMs: number;
  return: Record<string, unknown> | null;
  error: string | null;
  agents: AgentRecord[];
  logs: LogRecord[];
};

export async function runHarness(o: { bundleSource: string; args: unknown; engine: Engine; mainModel: string; cap: number; roleModels?: Record<string, string>; watch?: string[]; now?: () => number }): Promise<HarnessResult> {
  const bundle = loadBundle(o.bundleSource);
  const roleModels = { ...(o.roleModels ?? {}) };
  const { runtime, agents, logs, now } = createRuntime({ engine: o.engine, mainModel: o.mainModel, cap: o.cap, roleModels, watch: o.watch ?? [], ...(o.now ? { now: o.now } : {}) });
  const t0 = now();
  let ret: unknown = null;
  let error: string | null = null;
  try {
    ret = await bundle.run(runtime, o.args);
  } catch (e) {
    error = e instanceof Error ? (e.stack ?? e.message) : String(e);
  }
  return {
    meta: { name: bundle.meta["name"] },
    mainModel: o.mainModel,
    roleModels,
    cap: Math.max(1, Math.floor(o.cap) || 1),
    watch: [...(o.watch ?? [])],
    wallClockMs: now() - t0,
    return: ret && typeof ret === "object" ? (ret as Record<string, unknown>) : null,
    error,
    agents,
    logs,
  };
}

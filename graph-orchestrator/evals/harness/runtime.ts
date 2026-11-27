/**
 * The real Runtime the eval harness gives the shipped dispatch bundle: the
 * same three globals the Workflow harness supplies (agent, parallel, log),
 * with each agent() call run by an Engine (the Claude Agent SDK in the
 * sandbox, a stub under test).
 *
 * Failure semantics match what the plugin expects of the Workflow harness:
 * an engine that throws makes agent() throw; an engine with no output makes
 * agent() return null; a parallel() thunk that throws becomes null.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AgentOptions, Runtime } from "../../src/types.ts";

export type EngineRequest = { prompt: string; model: string; label?: string; schema?: Record<string, unknown> };
/** `output` is what agent() returns; `record` is engine detail kept on the agent's record (usage, init, skills). */
export type EngineResult = { output: unknown; record?: unknown };
export type Engine = (req: EngineRequest) => Promise<EngineResult>;

/** The options a role may pass; `model` is honoured when the plugin requests one. */
export type HarnessAgentOptions = AgentOptions & { model?: string };

export type AgentRecord = {
  n: number;
  label: string | null;
  /** The role the label names (roleOf). */
  role: string;
  /** The model this agent was requested on: a harness-forced role model, else the plugin's, else the main model. */
  model: string;
  /** When agent() was called. */
  calledMs: number;
  /** When the engine started, after waiting for a slot under the cap. */
  startMs: number | null;
  endMs: number | null;
  queuedMs: number | null;
  error: string | null;
  engine: unknown;
  /** What agent() returned (the role's answer through its schema); null when it threw or returned nothing. */
  output?: unknown;
  /** Per watched path, its sha256 just before the engine started and just after it ended; null while the file is missing. */
  watched?: Record<string, { before: string | null; after: string | null }>;
};

/** sha256 of a file's bytes, or null when it cannot be read. */
export function fileHash(path: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

/** Output tokens an engine record reports across its calls (`calls[].usage.output_tokens`); 0 when it reports none. */
export function outputTokensOf(record: unknown): number {
  const calls = (record as { calls?: unknown } | null)?.calls;
  if (!Array.isArray(calls)) return 0;
  return calls.reduce((sum: number, c) => {
    const n = Number((c as { usage?: { output_tokens?: unknown } | null } | null)?.usage?.output_tokens);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

export type LogRecord = { atMs: number; message: string };

export type HarnessRuntime = Runtime & { agent: (prompt: string, opts?: HarnessAgentOptions) => Promise<unknown> };

const ROLE_WORDS: Record<string, string> = { grapher: "scribe" };
const STAGE_PREFIX = /^Link [\d.]+(?: · [^,]+)?, /;

/** The role an agent label names (src/labels.ts); the same rule as scoring.role_of. */
export function roleOf(label: string | null | undefined): string {
  if (!label) return "unlabelled";
  const word = label.replace(STAGE_PREFIX, "").split(/[ :(]/, 1)[0]!.toLowerCase();
  return ROLE_WORDS[word] ?? word;
}

/**
 * `roleModels` forces a role onto a model (role -> model id) from the harness,
 * without changing the plugin: the routing check's demonstration. Empty in the
 * baseline, where every role runs on `mainModel`. `watch` names files (a
 * relay's progress file) hashed before and after every agent.
 */
export function createRuntime(o: { engine: Engine; mainModel: string; cap: number; roleModels?: Record<string, string>; watch?: string[]; now?: () => number }) {
  const watch = o.watch ?? [];
  const start = typeof performance !== "undefined" ? performance.now() : 0;
  const now = o.now ?? (() => Math.round(performance.now() - start));
  const cap = Math.max(1, Math.floor(o.cap) || 1);
  const agents: AgentRecord[] = [];
  const logs: LogRecord[] = [];

  // A counting semaphore: at most `cap` engines run at once, across every
  // parallel() call and nesting level.
  let running = 0;
  const waiting: Array<() => void> = [];
  const acquire = async () => {
    if (running < cap) {
      running++;
      return;
    }
    await new Promise<void>((r) => waiting.push(r));
  };
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };

  const agent = async (prompt: string, opts: HarnessAgentOptions = {}): Promise<unknown> => {
    const role = roleOf(opts.label);
    const model = o.roleModels?.[role] ?? opts.model ?? o.mainModel;
    const rec: AgentRecord = { n: agents.length + 1, label: opts.label ?? null, role, model, calledMs: now(), startMs: null, endMs: null, queuedMs: null, error: null, engine: null };
    agents.push(rec);
    await acquire();
    rec.startMs = now();
    rec.queuedMs = rec.startMs - rec.calledMs;
    if (watch.length) rec.watched = Object.fromEntries(watch.map((p) => [p, { before: fileHash(p), after: null }]));
    try {
      const res = await o.engine({ prompt, model, ...(opts.label !== undefined ? { label: opts.label } : {}), ...(opts.schema ? { schema: opts.schema } : {}) });
      rec.engine = res.record ?? null;
      rec.output = res.output ?? null;
      return res.output ?? null;
    } catch (e) {
      rec.error = e instanceof Error ? e.message : String(e);
      const record = (e as { record?: unknown } | null)?.record;
      if (record !== undefined) rec.engine = record;
      throw e;
    } finally {
      for (const p of watch) rec.watched![p]!.after = fileHash(p);
      rec.endMs = now();
      release();
    }
  };

  const parallel = async <T>(thunks: Array<() => Promise<T>>): Promise<Array<T | null>> =>
    Promise.all(
      thunks.map((t, i) =>
        t().catch((e: unknown) => {
          log(`parallel thunk ${i} threw: ${e instanceof Error ? e.message : String(e)}`);
          return null;
        }),
      ),
    );

  const log = (message: string) => {
    logs.push({ atMs: now(), message: String(message) });
  };

  // The Workflow harness's `budget` global: spent() is the output tokens of every call answered so far.
  const budget = { total: null, spent: () => agents.reduce((sum, a) => sum + outputTokensOf(a.engine), 0) };

  const runtime: HarnessRuntime = { agent, parallel, log, budget };
  return { runtime, agents, logs, now };
}

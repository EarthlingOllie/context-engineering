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
  model: string;
  /** When agent() was called. */
  calledMs: number;
  /** When the engine started, after waiting for a slot under the cap. */
  startMs: number | null;
  endMs: number | null;
  queuedMs: number | null;
  error: string | null;
  engine: unknown;
};

export type LogRecord = { atMs: number; message: string };

export type HarnessRuntime = Runtime & { agent: (prompt: string, opts?: HarnessAgentOptions) => Promise<unknown> };

export function createRuntime(o: { engine: Engine; mainModel: string; cap: number; now?: () => number }) {
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
    const model = opts.model ?? o.mainModel;
    const rec: AgentRecord = { n: agents.length + 1, label: opts.label ?? null, model, calledMs: now(), startMs: null, endMs: null, queuedMs: null, error: null, engine: null };
    agents.push(rec);
    await acquire();
    rec.startMs = now();
    rec.queuedMs = rec.startMs - rec.calledMs;
    try {
      const res = await o.engine({ prompt, model, ...(opts.label !== undefined ? { label: opts.label } : {}), ...(opts.schema ? { schema: opts.schema } : {}) });
      rec.engine = res.record ?? null;
      return res.output ?? null;
    } catch (e) {
      rec.error = e instanceof Error ? e.message : String(e);
      const record = (e as { record?: unknown } | null)?.record;
      if (record !== undefined) rec.engine = record;
      throw e;
    } finally {
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

  const runtime: HarnessRuntime = { agent, parallel, log };
  return { runtime, agents, logs, now };
}

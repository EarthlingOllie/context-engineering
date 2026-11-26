/**
 * The real engine: one Claude Code run (Claude Agent SDK `query()`) per
 * agent() call, with the role's prompt, the schema as structured output and
 * the requested model. Inside the Inspect sandbox ANTHROPIC_BASE_URL points
 * at the sandbox agent bridge, so every model call is an Inspect model call.
 *
 * Not unit-tested (it needs the SDK and a model); the Runtime around it is
 * tested with a stub engine. The SDK is imported by name at run time so the
 * plugin's own install and typecheck do not depend on it.
 */
import type { Engine } from "./runtime.ts";

type SdkMessage = { type: string; subtype?: string; [k: string]: unknown };
type SdkModule = { query: (a: { prompt: string; options: Record<string, unknown> }) => AsyncIterable<SdkMessage> };

export type EngineRecord = {
  init: { model: unknown; skills: unknown; claude_code_version: unknown } | null;
  calls: Array<{ model: unknown; usage: unknown }>;
  skillsInvoked: string[];
  result: Record<string, unknown> | null;
};

export async function sdkEngine(o: { cwd: string; skillsPlugin: string | null; sdkModule?: string }): Promise<Engine> {
  const name = o.sdkModule ?? "@anthropic-ai/claude-agent-sdk";
  const sdk = (await import(name)) as SdkModule;
  return async (req) => {
    const options: Record<string, unknown> = {
      model: req.model,
      cwd: o.cwd,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      settingSources: [],
      ...(o.skillsPlugin ? { plugins: [{ type: "local", path: o.skillsPlugin }] } : {}),
      env: { ...process.env },
      ...(req.schema ? { outputFormat: { type: "json_schema", schema: req.schema } } : {}),
    };
    const record: EngineRecord = { init: null, calls: [], skillsInvoked: [], result: null };
    const fail = (message: string) => Object.assign(new Error(message), { record });
    let final: SdkMessage | null = null;
    try {
      for await (const msg of sdk.query({ prompt: req.prompt, options })) {
        if (msg.type === "system" && msg.subtype === "init") {
          record.init = { model: msg["model"], skills: msg["skills"] ?? null, claude_code_version: msg["claude_code_version"] ?? null };
        } else if (msg.type === "assistant") {
          const m = (msg["message"] ?? {}) as { model?: unknown; usage?: unknown; content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }> };
          record.calls.push({ model: m.model ?? null, usage: m.usage ?? null });
          for (const b of m.content ?? []) if (b.type === "tool_use" && b.name === "Skill") record.skillsInvoked.push(String(b.input?.["skill"] ?? b.input?.["command"] ?? JSON.stringify(b.input)));
        } else if (msg.type === "result") {
          final = msg;
        }
      }
    } catch (e) {
      // Keep what the engine reported before it failed (init, calls) on the agent's record.
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { record });
    }
    if (!final) throw fail("engine ended without a result message");
    record.result = {
      subtype: final.subtype,
      is_error: final["is_error"],
      total_cost_usd: final["total_cost_usd"],
      usage: final["usage"],
      modelUsage: final["modelUsage"],
      num_turns: final["num_turns"],
    };
    if (final.subtype !== "success") throw fail(`engine result ${final.subtype}`);
    if (!req.schema) return { output: final["result"], record };
    const structured = final["structured_output"];
    return { output: structured ?? JSON.parse(String(final["result"])), record };
  };
}

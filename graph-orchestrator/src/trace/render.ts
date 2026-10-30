/**
 * The trace renderer: trace.jsonl text in, Mermaid flowchart out.
 * Waves become subgraphs, dispatches nodes labelled with topology and
 * iteration count, `dependsOn` edges, status as node class, chain stages as a
 * nested subgraph, human interventions as nodes.
 */
import type { TraceEvent } from "../types.ts";

type Dispatch = Extract<TraceEvent, { type: "dispatch" }>;
type Human = Extract<TraceEvent, { type: "human" }>;
type Wave = { number: number; at?: string; dispatches: Dispatch[]; stages: Map<string, Dispatch[]>; end?: Extract<TraceEvent, { type: "wave_end" }> };

export type ParsedTrace = { items: Array<{ kind: "wave"; wave: Wave } | { kind: "human"; human: Human; index: number }>; skipped: number };

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

/**
 * A line the renderer can draw, or null for one it cannot. A dispatch needs an
 * id and a status, a human intervention a trigger and a question; every other
 * field defaults, so one malformed line is skipped rather than aborting the
 * whole render. Other event types pass through as they are.
 */
function normalise(raw: unknown): TraceEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.type !== "string") return null;
  if (e.type === "dispatch") {
    const id = str(e.id);
    const status = str(e.status);
    if (!id || !status) return null;
    const d: Dispatch = {
      type: "dispatch",
      wave: typeof e.wave === "number" ? e.wave : NaN,
      id,
      topology: str(e.topology) ?? "unknown",
      iterations: typeof e.iterations === "number" && Number.isFinite(e.iterations) ? e.iterations : 0,
      status: status as Dispatch["status"],
      dependsOn: strs(e.dependsOn),
    };
    if (Array.isArray(e.stages)) d.stages = strs(e.stages);
    const parent = str(e.parent);
    if (parent) d.parent = parent;
    const question = str(e.question);
    if (question) d.question = question;
    return d;
  }
  if (e.type === "human") {
    const trigger = str(e.trigger);
    const question = str(e.question);
    if (!trigger || !question) return null;
    const h: Human = { type: "human", trigger: trigger as Human["trigger"], question, answer: str(e.answer) ?? "" };
    const at = str(e.at);
    if (at) h.at = at;
    const dispatch = str(e.dispatch);
    if (dispatch) h.dispatch = dispatch;
    if (e.mode === "attended" || e.mode === "autonomous") h.mode = e.mode;
    return h;
  }
  return raw as TraceEvent;
}

export function parseTrace(text: string, extra: TraceEvent[] = []): ParsedTrace {
  const events: TraceEvent[] = [];
  let skipped = 0;
  const take = (raw: unknown): void => {
    const e = normalise(raw);
    if (e) events.push(e);
    else skipped++;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      take(JSON.parse(line));
    } catch {
      skipped++;
    }
  }
  for (const e of extra) take(e);

  const items: ParsedTrace["items"] = [];
  const waves = new Map<number, Wave>();
  let current: Wave | null = null;
  let humans = 0;
  const openWave = (n: number, at?: string): Wave => {
    let w = waves.get(n);
    if (!w) {
      w = { number: n, dispatches: [], stages: new Map() };
      if (at) w.at = at;
      waves.set(n, w);
      items.push({ kind: "wave", wave: w });
    } else if (at && !w.at) w.at = at;
    return w;
  };
  for (const e of events) {
    switch (e.type) {
      case "wave_start":
        current = openWave(e.wave, e.at);
        break;
      case "dispatch": {
        const w = Number.isFinite(e.wave) ? openWave(e.wave) : current ?? openWave(0);
        if (e.parent) {
          const list = w.stages.get(e.parent) ?? [];
          list.push(e);
          w.stages.set(e.parent, list);
        } else w.dispatches.push(e);
        break;
      }
      case "wave_end":
        openWave(e.wave).end = e;
        break;
      case "human":
        items.push({ kind: "human", human: e, index: ++humans });
        break;
      default:
        skipped++;
    }
  }
  return { items, skipped };
}

const CLASSES: Record<string, string> = {
  done: "fill:#dcfce7,stroke:#16a34a,color:#14532d",
  blocked: "fill:#fee2e2,stroke:#dc2626,color:#7f1d1d",
  exhausted: "fill:#fef3c7,stroke:#d97706,color:#78350f",
  over_budget: "fill:#fef3c7,stroke:#d97706,stroke-dasharray:4 2,color:#78350f",
  failed: "fill:#f3f4f6,stroke:#6b7280,stroke-dasharray:4 2,color:#111827",
  human: "fill:#ede9fe,stroke:#7c3aed,color:#3b0764",
};

export function nodeId(id: string): string {
  const s = String(id).replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(s) ? s : `n_${s}`;
}

export function esc(text: string): string {
  return String(text).replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/\n/g, " ");
}

function short(text: string, max = 48): string {
  const t = String(text).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function label(d: Dispatch): string {
  const parts = [`${d.id}`, `${d.topology} ×${d.iterations}`];
  if (d.status !== "done") parts.push(d.status.replace("_", " "));
  if (d.question) parts.push(`? ${short(d.question, 40)}`);
  return parts.map(esc).join("<br/>");
}

const WAVE_STATUSES = ["done", "blocked", "exhausted", "over_budget", "failed"] as const;

/** The wave_end counts for the subgraph title: non-zero statuses only, in catalog order. */
function waveCounts(end: Wave["end"]): string[] {
  if (!end) return [];
  return WAVE_STATUSES.filter((s) => typeof end[s] === "number" && end[s] > 0).map((s) => `${end[s]} ${s.replace("_", " ")}`);
}

function statusClass(status: string): string {
  return CLASSES[status] ? status : "failed";
}

export function renderTrace(text: string, extra: TraceEvent[] = []): string {
  const { items, skipped } = parseTrace(text, extra);
  const out: string[] = ["flowchart TD"];
  for (const [name, style] of Object.entries(CLASSES)) out.push(`  classDef ${name} ${style}`);
  if (skipped) out.push(`  %% ${skipped} unreadable line(s) skipped`);

  const known = new Set<string>();
  const edges: string[] = [];
  const humansByDispatch = new Map<string, string[]>(); // dispatch id -> human node ids
  const seenDispatches: Array<{ id: string; dependsOn: string[] }> = [];

  for (const item of items) {
    if (item.kind === "human") {
      const h = item.human;
      const hid = `human_${item.index}`;
      const title = [`human · ${h.trigger}`, h.dispatch ? `on ${h.dispatch}` : "", short(h.question, 60), h.answer ? `→ ${short(h.answer, 40)}` : ""].filter(Boolean);
      out.push(`  ${hid}([${JSON.stringify(title.map(esc).join("<br/>"))}]):::human`);
      if (h.dispatch && known.has(h.dispatch)) {
        edges.push(`  ${nodeId(h.dispatch)} --> ${hid}`);
        const list = humansByDispatch.get(h.dispatch) ?? [];
        list.push(hid);
        humansByDispatch.set(h.dispatch, list);
      }
      continue;
    }
    const w = item.wave;
    const title = [`Wave ${w.number}`, w.at ? esc(w.at) : "", ...waveCounts(w.end)].filter(Boolean).join(" · ");
    out.push(`  subgraph wave${w.number}[${JSON.stringify(title)}]`);
    out.push("    direction TB");
    if (w.dispatches.length === 0) out.push(`    wave${w.number}_empty([no dispatches])`);
    // A chain with traced stages is a nested subgraph; its stages may be chains too, so this recurses.
    const draw = (d: Dispatch, indent: string): void => {
      const stages = w.stages.get(d.id);
      if (d.topology === "chain" && stages && stages.length) {
        const chainTitle = [`${d.id}`, `chain ×${d.iterations}`, d.status !== "done" ? d.status.replace("_", " ") : ""].filter(Boolean).map(esc).join(" · ");
        out.push(`${indent}subgraph ${nodeId(d.id)}[${JSON.stringify(chainTitle)}]`);
        out.push(`${indent}  direction LR`);
        let prev: string | null = null;
        for (const s of stages) {
          draw(s, `${indent}  `);
          if (prev) out.push(`${indent}  ${prev} --> ${nodeId(s.id)}`);
          prev = nodeId(s.id);
        }
        out.push(`${indent}end`);
        out.push(`${indent}class ${nodeId(d.id)} ${statusClass(d.status)}`);
      } else {
        const text = d.topology === "chain" && d.stages?.length ? `${label(d)}<br/>${esc(d.stages.join(", "))}` : label(d);
        out.push(`${indent}${nodeId(d.id)}[${JSON.stringify(text)}]:::${statusClass(d.status)}`);
      }
      known.add(d.id);
    };
    for (const d of w.dispatches) {
      draw(d, "    ");
      seenDispatches.push({ id: d.id, dependsOn: d.dependsOn ?? [] });
      // Dotted edges from an intervention to a dispatch that resumed after it: only interventions already in the trace count, so a same-wave dispatch that ran before the intervention gets none.
      for (const dep of d.dependsOn ?? []) for (const hid of humansByDispatch.get(dep) ?? []) edges.push(`  ${hid} -.-> ${nodeId(d.id)}`);
    }
    out.push("  end");
  }

  // Dependency edges.
  for (const d of seenDispatches) {
    for (const dep of d.dependsOn) {
      if (dep === d.id) continue;
      if (known.has(dep)) edges.push(`  ${nodeId(dep)} --> ${nodeId(d.id)}`);
      else edges.push(`  %% ${d.id} depends on unknown ${dep}`);
    }
  }
  out.push(...Array.from(new Set(edges)));
  return out.join("\n") + "\n";
}

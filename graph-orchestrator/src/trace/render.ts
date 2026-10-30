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

export function parseTrace(text: string, extra: TraceEvent[] = []): ParsedTrace {
  const events: TraceEvent[] = [];
  let skipped = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e === "object" && typeof e.type === "string") events.push(e as TraceEvent);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  events.push(...extra);

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
    const title = `Wave ${w.number}${w.at ? ` · ${esc(w.at)}` : ""}`;
    out.push(`  subgraph wave${w.number}[${JSON.stringify(title)}]`);
    out.push("    direction TB");
    if (w.dispatches.length === 0) out.push(`    wave${w.number}_empty([no dispatches])`);
    for (const d of w.dispatches) {
      const stages = w.stages.get(d.id);
      if (d.topology === "chain" && stages && stages.length) {
        const chainTitle = [`${d.id}`, `chain ×${d.iterations}`, d.status !== "done" ? d.status.replace("_", " ") : ""].filter(Boolean).map(esc).join(" · ");
        out.push(`    subgraph ${nodeId(d.id)}[${JSON.stringify(chainTitle)}]`);
        out.push("      direction LR");
        let prev: string | null = null;
        for (const s of stages) {
          out.push(`      ${nodeId(s.id)}[${JSON.stringify(label(s))}]:::${statusClass(s.status)}`);
          if (prev) out.push(`      ${prev} --> ${nodeId(s.id)}`);
          prev = nodeId(s.id);
          known.add(s.id);
        }
        out.push("    end");
        out.push(`    class ${nodeId(d.id)} ${statusClass(d.status)}`);
      } else {
        const text = d.topology === "chain" && d.stages?.length ? `${label(d)}<br/>${esc(d.stages.join(", "))}` : label(d);
        out.push(`    ${nodeId(d.id)}[${JSON.stringify(text)}]:::${statusClass(d.status)}`);
      }
      known.add(d.id);
      seenDispatches.push({ id: d.id, dependsOn: d.dependsOn ?? [] });
    }
    out.push("  end");
  }

  // Dependency edges, and dotted edges from an intervention to the dispatches that resumed after it.
  for (const d of seenDispatches) {
    for (const dep of d.dependsOn) {
      if (dep === d.id) continue;
      if (known.has(dep)) edges.push(`  ${nodeId(dep)} --> ${nodeId(d.id)}`);
      else edges.push(`  %% ${d.id} depends on unknown ${dep}`);
      for (const hid of humansByDispatch.get(dep) ?? []) edges.push(`  ${hid} -.-> ${nodeId(d.id)}`);
    }
  }
  out.push(...Array.from(new Set(edges)));
  return out.join("\n") + "\n";
}

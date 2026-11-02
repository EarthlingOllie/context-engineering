// ingest: transcript rows / GraphEvents -> Graph (design.md 4.1). Pure; never throws.
import type { Graph, GraphEdge, GraphEvent, GraphNode, NodeKind, Usage } from './types.ts'
import { estimateTokens } from './tokens.ts'

const METADATA_TYPES = new Set(['queue-operation', 'last-prompt', 'ai-title', 'tools-used', 'atis-latch'])
const DEFAULT_MAX_NODES = 300
const LABEL_MAX = 60

type Row = Record<string, unknown>
const isObj = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v)

export function emptyGraph(): Graph {
  return { nodes: {}, edges: [], latestPromptId: null, latestTurnId: null, promptTurnId: null, seq: 0, meta: { skipped: 0 } }
}

export function label(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > LABEL_MAX ? flat.slice(0, LABEL_MAX - 1) + '…' : flat
}

function contentChars(content: unknown): number {
  if (typeof content === 'string') return content.length
  if (Array.isArray(content)) {
    let n = 0
    for (const b of content) {
      if (typeof b === 'string') n += b.length
      else if (isObj(b)) {
        if (typeof b.text === 'string') n += b.text.length
        else if (b.content !== undefined) n += contentChars(b.content)
        else n += JSON.stringify(b).length
      }
    }
    return n
  }
  return 0
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === 'string' ? b : isObj(b) && b.type === 'text' && typeof b.text === 'string' ? b.text : ''))
      .join('')
  }
  return ''
}

/** Transcript JSONL objects (or session.append rows of the same shape) -> GraphEvents. */
export function rowsToEvents(rows: unknown[]): GraphEvent[] {
  const out: GraphEvent[] = []
  const seenUsage = new Set<string>()
  for (const row of rows) {
    try {
      rowToEvents(row, out, seenUsage)
    } catch {
      // a row we cannot read adds nothing
    }
  }
  return out
}

function rowToEvents(row: unknown, out: GraphEvent[], seenUsage: Set<string>): void {
  if (!isObj(row)) return
  const type = row.type
  if (typeof type !== 'string' || METADATA_TYPES.has(type)) return
  if (row.isSidechain === true || typeof row.agentId === 'string') return

  if (type === 'summary') {
    const s = typeof row.summary === 'string' ? row.summary : ''
    out.push({ kind: 'compact', id: String(row.leafUuid ?? row.uuid ?? 'legacy'), summaryChars: s.length })
    return
  }
  if (type === 'system') {
    if (row.subtype === 'compact_boundary') {
      const md = isObj(row.compactMetadata) ? row.compactMetadata : {}
      const ev: GraphEvent = { kind: 'compact', id: String(row.uuid ?? 'compact'), summaryChars: 0 }
      if (typeof md.preTokens === 'number') ev.preTokens = md.preTokens
      out.push(ev)
    }
    return
  }
  if (type === 'attachment') {
    const rendered = Array.isArray(row.rendered) ? row.rendered : []
    let chars = 0
    for (const r of rendered) if (isObj(r)) chars += contentChars(r.content)
    if (chars === 0 && isObj(row.attachment)) chars = JSON.stringify(row.attachment).length
    out.push({ kind: 'attachment', chars })
    return
  }

  const msg = isObj(row.message) ? row.message : null
  if (!msg) return

  if (type === 'user') {
    const content = msg.content
    if (row.isCompactSummary === true) {
      const chars = contentChars(content)
      const last = out[out.length - 1]
      if (last && last.kind === 'compact' && last.summaryChars === 0) last.summaryChars = chars
      else out.push({ kind: 'compact', id: String(row.uuid ?? 'compact'), summaryChars: chars })
      return
    }
    if (Array.isArray(content) && content.some((b) => isObj(b) && b.type === 'tool_result')) {
      for (const b of content) {
        if (isObj(b) && b.type === 'tool_result' && typeof b.tool_use_id === 'string') {
          out.push({ kind: 'tool_result', toolUseId: b.tool_use_id, chars: contentChars(b.content), isError: b.is_error === true })
        }
      }
      return
    }
    if (row.isMeta === true) {
      out.push({ kind: 'injected', chars: contentChars(content) })
      return
    }
    const text = contentText(content)
    out.push({ kind: 'prompt', id: String(row.uuid ?? row.promptId ?? `p${out.length}`), text })
    return
  }

  if (type === 'assistant') {
    const messageId = String(msg.id ?? row.uuid ?? `m${out.length}`)
    const blocks = Array.isArray(msg.content) ? msg.content : [msg.content]
    let text = ''
    const tools: GraphEvent[] = []
    for (const b of blocks) {
      if (typeof b === 'string') text += b
      else if (isObj(b)) {
        if (b.type === 'text' && typeof b.text === 'string') text += b.text
        else if (b.type === 'thinking' && typeof b.thinking === 'string') text += b.thinking
        else if (b.type === 'tool_use' && typeof b.id === 'string') {
          tools.push({ kind: 'tool_use', id: b.id, messageId, name: String(b.name ?? 'tool'), input: b.input ?? {} })
        }
      }
    }
    const ev: GraphEvent = { kind: 'assistant', messageId, text }
    if (isObj(msg.usage) && !seenUsage.has(messageId)) {
      seenUsage.add(messageId)
      ev.usage = msg.usage as Usage
    }
    out.push(ev, ...tools)
  }
}

export function parseJsonl(jsonl: string): { rows: unknown[]; skipped: number } {
  const rows: unknown[] = []
  let skipped = 0
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      skipped++
    }
  }
  return { rows, skipped }
}

export function buildGraph(jsonl: string, opts?: { maxNodes?: number }): Graph {
  const { rows, skipped } = parseJsonl(jsonl)
  const g = applyEvents(emptyGraph(), rowsToEvents(rows), opts)
  g.meta.skipped += skipped
  return g
}

// ---------------------------------------------------------------- reducer

function filePathOf(name: string, input: unknown): string | null {
  if (!isObj(input)) return null
  const p = input.file_path ?? input.notebook_path ?? input.path
  if (typeof p !== 'string' || !p) return null
  if ((name === 'Grep' || name === 'Glob' || input.file_path === undefined) && input.notebook_path === undefined) {
    const base = p.split('/').pop() ?? ''
    if (!/\.[A-Za-z0-9]+$/.test(base)) return null // a directory, not a file
  }
  return p
}

function toolLabel(name: string, input: unknown): string {
  if (isObj(input)) {
    const hint = input.file_path ?? input.path ?? input.command ?? input.pattern ?? input.skill ?? input.url ?? input.query
    if (typeof hint === 'string') return label(`${name} ${hint}`)
  }
  return label(name)
}

/** Pure reducer: returns a new Graph with the events applied. */
export function applyEvents(g0: Graph, evs: GraphEvent[], opts?: { maxNodes?: number }): Graph {
  const g: Graph = {
    ...g0,
    nodes: Object.fromEntries(Object.entries(g0.nodes).map(([k, n]) => [k, { ...n, ...(n.meta ? { meta: { ...n.meta } } : {}) }])),
    edges: g0.edges.slice(),
    meta: { ...g0.meta },
  }
  const edgeKeys = new Set(g.edges.map((e) => `${e.from}>${e.to}`))
  const addNode = (id: string, kind: NodeKind, lbl: string, tokens: number, meta?: GraphNode['meta']): GraphNode => {
    const existing = g.nodes[id]
    if (existing) return existing
    const n: GraphNode = { id, kind, label: lbl, tokens: Math.max(1, Math.round(tokens)), seq: ++g.seq, inWindow: true }
    if (meta) n.meta = meta
    g.nodes[id] = n
    return n
  }
  const addEdge = (from: string, to: string, kind: GraphEdge['kind']): void => {
    const k = `${from}>${to}`
    if (edgeKeys.has(k) || !g.nodes[from] || !g.nodes[to]) return
    edgeKeys.add(k)
    g.edges.push({ from, to, kind })
  }
  const addSystemTokens = (name: string, tokens: number, replace = false): void => {
    const id = `system:${name}`
    const existing = g.nodes[id]
    if (!existing) {
      addNode(id, 'system', label(name), tokens)
      return
    }
    const n = existing
    n.tokens = Math.max(1, Math.round(replace ? tokens : n.tokens + tokens))
    n.inWindow = true
  }

  for (const ev of evs) {
    try {
      switch (ev.kind) {
        case 'prompt': {
          const id = `prompt:${ev.id}`
          addNode(id, 'prompt', label(ev.text) || '(prompt)', estimateTokens(ev.text.length))
          g.latestPromptId = id
          g.promptTurnId = null
          break
        }
        case 'injected':
          addSystemTokens('injected', estimateTokens(ev.chars))
          break
        case 'attachment':
          addSystemTokens('attachments', estimateTokens(ev.chars))
          break
        case 'context':
          for (const c of ev.categories) addSystemTokens(c.name, c.tokens, true)
          break
        case 'assistant': {
          const id = `turn:${ev.messageId}`
          const isNew = !g.nodes[id]
          const n = addNode(id, 'turn', label(ev.text) || '(assistant turn)', 0)
          const textTokens = ev.text.length / 4
          if (isNew) n.tokens = 0
          n.tokens += textTokens
          if (ev.usage) {
            const out = ev.usage.output_tokens ?? 0
            n.tokens += out - (n.meta?.outputTokens ?? 0)
            n.meta = { ...n.meta, outputTokens: out, windowTokens: (ev.usage.input_tokens ?? 0) + (ev.usage.cache_creation_input_tokens ?? 0) + (ev.usage.cache_read_input_tokens ?? 0) }
          }
          n.tokens = Math.max(1, Math.ceil(n.tokens))
          if (ev.text && (n.label === '(assistant turn)' || isNew)) n.label = label(ev.text) || n.label
          if (isNew) linkTurn(g, id, addEdge)
          break
        }
        case 'tool_use': {
          const turnId = `turn:${ev.messageId}`
          if (!g.nodes[turnId]) {
            addNode(turnId, 'turn', '(assistant turn)', 1)
            linkTurn(g, turnId, addEdge)
          }
          const id = `tool:${ev.id}`
          const inputChars = JSON.stringify(ev.input ?? {}).length
          const path = filePathOf(ev.name, ev.input)
          const meta: GraphNode['meta'] = { tool: ev.name }
          if (path) meta.path = path
          addNode(id, 'tool', toolLabel(ev.name, ev.input), estimateTokens(inputChars), meta)
          addEdge(turnId, id, 'turn-tool')
          if (path) {
            const fid = `file:${path}`
            const f = addNode(fid, 'file', label(path.split('/').slice(-2).join('/')), 1, { path })
            f.inWindow = true
            addEdge(id, fid, 'tool-file')
          }
          break
        }
        case 'tool_result': {
          const n = g.nodes[`tool:${ev.toolUseId}`]
          if (!n) break
          n.tokens = Math.max(1, Math.ceil(n.tokens + ev.chars / 4))
          if (ev.isError) n.meta = { ...n.meta, isError: true }
          // the file node's size tracks what was read into the window
          if (n.meta?.path) {
            const f = g.nodes[`file:${n.meta.path}`]
            if (f) f.tokens = Math.max(f.tokens, Math.ceil(ev.chars / 4), 1)
          }
          break
        }
        case 'compact': {
          for (const n of Object.values(g.nodes)) n.inWindow = false
          const id = `compact:${ev.id}`
          const n = addNode(id, 'compaction', 'Compaction summary', estimateTokens(ev.summaryChars))
          n.inWindow = true
          if (ev.preTokens !== undefined) n.meta = { ...n.meta, windowTokens: ev.preTokens }
          g.latestTurnId = null
          g.promptTurnId = null
          break
        }
      }
    } catch {
      g.meta.skipped++
    }
  }
  return evict(g, opts?.maxNodes ?? DEFAULT_MAX_NODES)
}

function linkTurn(g: Graph, turnId: string, addEdge: (f: string, t: string, k: GraphEdge['kind']) => void): void {
  if (g.latestPromptId && g.promptTurnId === null && g.nodes[g.latestPromptId]?.inWindow) {
    addEdge(g.latestPromptId, turnId, 'prompt-turn')
    g.promptTurnId = turnId
  } else if (g.latestTurnId && g.nodes[g.latestTurnId]?.inWindow) {
    addEdge(g.latestTurnId, turnId, 'turn-turn')
  }
  g.latestTurnId = turnId
}

// ---------------------------------------------------------------- eviction

function evict(g: Graph, maxNodes: number): Graph {
  const ids = Object.keys(g.nodes)
  if (ids.length <= maxNodes) return g
  const protectedIds = new Set<string>()
  if (g.latestPromptId && g.nodes[g.latestPromptId]) {
    protectedIds.add(g.latestPromptId)
    for (const e of g.edges) {
      if (e.from === g.latestPromptId) protectedIds.add(e.to)
      if (e.to === g.latestPromptId) protectedIds.add(e.from)
    }
  }
  if (g.latestTurnId) protectedIds.add(g.latestTurnId)
  const bySeq = (a: GraphNode, b: GraphNode) => a.seq - b.seq
  const nodes = Object.values(g.nodes).filter((n) => !protectedIds.has(n.id))
  const order = [
    ...nodes.filter((n) => !n.inWindow).sort(bySeq),
    ...nodes.filter((n) => n.inWindow && (n.kind === 'tool' || n.kind === 'file')).sort(bySeq),
    ...nodes.filter((n) => n.inWindow && (n.kind === 'turn' || n.kind === 'prompt')).sort(bySeq),
  ]
  let excess = ids.length - maxNodes
  for (const n of order) {
    if (excess <= 0) break
    delete g.nodes[n.id]
    excess--
  }
  g.edges = g.edges.filter((e) => g.nodes[e.from] && g.nodes[e.to])
  if (g.latestTurnId && !g.nodes[g.latestTurnId]) g.latestTurnId = null
  if (g.promptTurnId && !g.nodes[g.promptTurnId]) g.promptTurnId = null
  return g
}

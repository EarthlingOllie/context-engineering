// live: the shell's engine events -> graph changes (design.md section 5), kept pure so node:test covers them.
// session.append hands one row per response block with no message id, so a cursor groups consecutive
// assistant rows into one turn.
import { applyEvents, rowsToEvents } from './ingest.ts'
import type { Graph, GraphEvent } from './types.ts'

export interface AppendCursor {
  /** id of the turn the current run of assistant rows belongs to; null after any non-assistant row */
  turn: string | null
}

export const emptyCursor = (): AppendCursor => ({ turn: null })

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function contentChars(content: unknown): number {
  if (typeof content === 'string') return content.length
  if (!Array.isArray(content)) return 0
  let n = 0
  for (const b of content) n += isObj(b) && typeof b.text === 'string' ? b.text.length : JSON.stringify(b ?? '').length
  return n
}

/** One `session.append` input ({ message, uuid, door, agentId? }) -> events, and the next cursor. */
export function appendToEvents(input: unknown, cursor: AppendCursor): { events: GraphEvent[]; cursor: AppendCursor } {
  const none = { events: [], cursor }
  if (!isObj(input) || !isObj(input.message)) return none
  if (typeof input.agentId === 'string') return none // subagent rows are not in this window
  if (input.door === 'compaction') return { events: [], cursor: { turn: null } } // session.compact owns compaction
  const m = input.message
  const uuid = String(input.uuid ?? '')
  const type = m.type
  if (type === 'assistant') {
    const turn = cursor.turn ?? uuid
    const events = rowsToEvents([{ type: 'assistant', uuid, message: { id: turn, role: 'assistant', content: m.content } }])
    return { events, cursor: { turn } }
  }
  const next = { turn: null }
  if (type === 'user') return { events: rowsToEvents([{ type: 'user', uuid, isMeta: m.isMeta === true || undefined, message: { role: 'user', content: m.content } }]), cursor: next }
  if (type === 'attachment') return { events: [{ kind: 'attachment', chars: contentChars(m.content) }], cursor: next }
  return { events: [], cursor: next } // notices: the model never reads them
}

/**
 * Node ids a free-text query names. A file whose path or basename equals the query wins outright;
 * otherwise any node whose label or file path contains it (case-insensitive). Blank queries match nothing.
 */
export function matchNodes(g: Graph, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const nodes = Object.values(g.nodes)
  const exact = nodes.filter((n) => {
    const path = (n.meta?.path ?? '').toLowerCase()
    return n.kind === 'file' && path !== '' && (path === q || path.endsWith(`/${q}`))
  })
  if (exact.length) return exact.map((n) => n.id)
  return nodes.filter((n) => n.label.toLowerCase().includes(q) || (n.meta?.path ?? '').toLowerCase().includes(q)).map((n) => n.id)
}

/** What tool.call learns after the tool ran; only fills what session.append has not already given. */
export function enrichTool(g: Graph, toolUseId: string, info: { isError?: boolean }): Graph {
  const n = g.nodes[`tool:${toolUseId}`]
  if (!n || !info.isError || n.meta?.isError) return g
  return { ...g, nodes: { ...g.nodes, [n.id]: { ...n, meta: { ...n.meta, isError: true } } } }
}

/** turn.complete's usage -> tokens on the latest turn (window occupancy and output). */
export function applyTurnUsage(g: Graph, usage: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number } | undefined): Graph {
  const id = g.latestTurnId
  if (!usage || !id || !g.nodes[id]) return g
  return applyEvents(g, [{ kind: 'assistant', messageId: id.slice('turn:'.length), text: '', usage }])
}

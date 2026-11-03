// The actual design from source (v3 design.md 4.3, deep module #12). Pure: no I/O except through an injected SourceFs.
// scanFile is a single-pass lexer plus a bracket-depth statement reader (no TypeScript compiler, no dependency);
// assemble resolves file scans into modules, types and relations; collectSources walks a root through SourceFs.

export interface ScanMember { name: string; text: string; kind: 'attribute' | 'operation'; visibility: '+' | '-' | '#' }
export interface ScanImport { spec: string; typeOnly: boolean; reexport: boolean; line: number }
export interface ScanType {
  name: string; kind: 'class' | 'interface'; exported: boolean; stereotype?: 'abstract' | 'type' | 'enum'
  extends: string[]; implements: string[]; attributes: ScanMember[]; operations: ScanMember[]; line: number
}
export interface FileScan {
  /** relative to root, '/' separators */
  path: string
  imports: ScanImport[]
  /** exported functions and exported arrow/function consts */
  functions: ScanMember[]
  /** other exported consts and lets, as attributes */
  consts: ScanMember[]
  types: ScanType[]
  /** lexer recoveries; never thrown */
  errors: string[]
}
export interface ActualModule {
  path: string
  /** basename sans extension */
  name: string
  functions: ScanMember[]
  consts: ScanMember[]
  /** resolved in-root paths */
  deps: string[]
  reexports: string[]
  /** resolved out-of-root paths, root-relative ("../vendor/three-math/index.js") */
  outside: string[]
  /** package names */
  externals: string[]
}
export interface ActualType {
  /** `${path}#${name}` */
  id: string; module: string; name: string; kind: 'class' | 'interface'
  exported: boolean; stereotype?: string; attributes: ScanMember[]; operations: ScanMember[]
}
export interface ActualRelation { from: string; to: string; kind: 'dependency' | 'realization' | 'generalization' | 'association'; typeOnly?: boolean }
export interface ActualDesign {
  root: string; modules: Record<string, ActualModule>; types: Record<string, ActualType>
  relations: ActualRelation[]; skipped: { path: string; reason: string }[]; truncated: boolean
}
export interface SourceEntry { name: string; kind: 'file' | 'directory' | 'other'; size: number; mtimeMs: number }
export interface SourceFs { list(path: string): Promise<SourceEntry[]>; read(path: string): Promise<string> }
export interface ScannedFile { mtimeMs: number; size: number; scan: FileScan }
export interface CollectResult {
  files: Record<string, ScannedFile>; skipped: { path: string; reason: string }[]; truncated: boolean; read: number
}

export const SCAN_LIMITS = { files: 400, bytesPerFile: 262144, totalBytes: 4194304, depth: 8, entries: 4000 } as const

// ---------------------------------------------------------------------------------------------------------------
// Lexer

type TokKind = 'id' | 'p' | 'str' | 'num' | 'tpl' | 're' | 'eof'
interface Tok {
  t: TokKind
  v: string
  s: number
  e: number
  line: number
  /** a newline separates this token from the previous emitted one */
  nl: boolean
  /** first character of its line */
  bol: boolean
}

const REGEX_KW = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof'])

function isIdStart(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c > 127
}
function isIdPart(c: number): boolean {
  return isIdStart(c) || (c >= 48 && c <= 57)
}

/** Tokens at template depth 0 only: a template literal is one opaque 'tpl' token, its `${}` code is lexed but not emitted. */
function lex(src: string, errors: string[]): Tok[] {
  const n = src.length
  const lineStarts = [0]
  for (let i = src.indexOf('\n'); i !== -1; i = src.indexOf('\n', i + 1)) lineStarts.push(i + 1)
  let cur = 0
  const lineOf = (off: number): number => {
    if (off >= lineStarts[cur]!) {
      while (cur + 1 < lineStarts.length && lineStarts[cur + 1]! <= off) cur++
      return cur + 1
    }
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid]! <= off) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  const toks: Tok[] = []
  let prevEndLine = 0
  const emit = (t: TokKind, v: string, s: number, e: number): void => {
    const line = lineOf(s)
    toks.push({ t, v, s, e, line, nl: line > prevEndLine, bol: lineStarts[line - 1] === s })
    prevEndLine = e - s > 1 && (t === 'tpl' || t === 'str') ? lineOf(e - 1) : line
  }
  // brace stack: 0 = plain brace, 1 = template expression `${`
  const stack: number[] = []
  let tplDepth = 0
  let regexOk = true
  let tplStart = 0

  /** Scans template text from j; returns the index after the closing backtick or after an opening `${`. */
  const templatePart = (j: number): number => {
    while (j < n) {
      const c = src.charCodeAt(j)
      if (c === 92) { j += 2; continue }
      if (c === 96) {
        if (tplDepth === 0) emit('tpl', '', tplStart, j + 1)
        regexOk = false
        return j + 1
      }
      if (c === 36 && src.charCodeAt(j + 1) === 123) {
        stack.push(1)
        tplDepth++
        regexOk = true
        return j + 2
      }
      j++
    }
    errors.push(`unterminated template literal at line ${lineOf(tplStart)}`)
    if (tplDepth === 0) emit('tpl', '', tplStart, n)
    return n
  }

  let i = 0
  if (src.startsWith('#!')) i = src.indexOf('\n') === -1 ? n : src.indexOf('\n')
  while (i < n) {
    const c = src.charCodeAt(i)
    if (c === 32 || c === 10 || c === 9 || c === 13 || c === 0xa0 || c === 0xfeff || c === 11 || c === 12) { i++; continue }
    const out = tplDepth === 0
    if (c === 47) { // '/'
      const d = src.charCodeAt(i + 1)
      if (d === 47) { const e = src.indexOf('\n', i); i = e === -1 ? n : e; continue }
      if (d === 42) {
        const e = src.indexOf('*/', i + 2)
        if (e === -1) { errors.push(`unterminated comment at line ${lineOf(i)}`); i = n } else i = e + 2
        continue
      }
      if (regexOk) {
        let j = i + 1
        let inClass = false
        let ok = false
        while (j < n) {
          const r = src.charCodeAt(j)
          if (r === 10 || r === 13) break
          if (r === 92) { j += 2; continue }
          if (r === 91) inClass = true
          else if (r === 93) inClass = false
          else if (r === 47 && !inClass) { ok = true; j++; break }
          j++
        }
        if (ok) {
          while (j < n && isIdPart(src.charCodeAt(j))) j++
          if (out) emit('re', '', i, j)
          regexOk = false
          i = j
          continue
        }
      }
      if (out) emit('p', '/', i, i + 1)
      regexOk = true
      i++
      continue
    }
    if (c === 39 || c === 34) { // quotes
      let j = i + 1
      let closed = false
      while (j < n) {
        const r = src.charCodeAt(j)
        if (r === 92) { j += 2; continue }
        if (r === c) { closed = true; break }
        if (r === 10) break
        j++
      }
      if (!closed) errors.push(`unterminated string at line ${lineOf(i)}`)
      if (out) emit('str', src.slice(i + 1, Math.min(j, n)), i, Math.min(j + 1, n))
      regexOk = false
      i = closed ? j + 1 : j
      continue
    }
    if (c === 96) { // backtick
      tplStart = i
      i = templatePart(i + 1)
      continue
    }
    if (c === 123) { // {
      stack.push(0)
      if (out) emit('p', '{', i, i + 1)
      regexOk = true
      i++
      continue
    }
    if (c === 125) { // }
      const top = stack.pop()
      if (top === 1) {
        tplDepth--
        i = templatePart(i + 1)
        continue
      }
      if (out) emit('p', '}', i, i + 1)
      regexOk = false
      i++
      continue
    }
    if (isIdStart(c) || (c === 35 && isIdStart(src.charCodeAt(i + 1)))) {
      let j = i + 1
      while (j < n && isIdPart(src.charCodeAt(j))) j++
      const v = src.slice(i, j)
      if (out) emit('id', v, i, j)
      regexOk = REGEX_KW.has(v)
      i = j
      continue
    }
    if ((c >= 48 && c <= 57) || (c === 46 && src.charCodeAt(i + 1) >= 48 && src.charCodeAt(i + 1) <= 57)) {
      let j = i + 1
      while (j < n && (isIdPart(src.charCodeAt(j)) || src.charCodeAt(j) === 46)) j++
      if (out) emit('num', src.slice(i, j), i, j)
      regexOk = false
      i = j
      continue
    }
    let v = src[i]!
    if (src.startsWith('=>', i)) v = '=>'
    else if (src.startsWith('...', i)) v = '...'
    else if (src.startsWith('?.', i) && !(src.charCodeAt(i + 2) >= 48 && src.charCodeAt(i + 2) <= 57)) v = '?.'
    if (out) emit('p', v, i, i + v.length)
    regexOk = !(v === ')' || v === ']')
    i += v.length
  }
  return toks
}

// ---------------------------------------------------------------------------------------------------------------
// Statement reader

const OPEN = new Set(['(', '[', '{'])
const CLOSE = new Set([')', ']', '}'])
/** a token at column 0 with one of these while a bracket is open means the bracket was never closed */
const RESYNC = new Set(['export', 'import', 'function', 'class', 'interface', 'const', 'let', 'enum', 'abstract', 'declare'])
const MODIFIERS = new Set(['public', 'private', 'protected', 'static', 'readonly', 'abstract', 'declare', 'override', 'async', 'get', 'set', 'accessor'])
const CONT_BEFORE = new Set(['=', '=>', '(', '[', '{', ',', '+', '-', '*', '/', '%', '|', '&', '?', ':', '<', '>', '!', '.', '?.', '^', '~', '...'])
const CONT_AT = new Set(['.', '?.', '+', '-', '*', '/', '%', '|', '&', '?', ':', '=', '=>', '<', '>', '^', ')', ']', '}'])
const CONT_KW = new Set(['return', 'new', 'typeof', 'await', 'in', 'of', 'instanceof', 'extends', 'keyof', 'as', 'satisfies', 'is'])
const END_TOK = new Set([')', ']', '}', '>'])

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim()
const cut = (s: string): string => (s.length > 80 ? s.slice(0, 79) + '…' : s)

/** Scans one source file. Never throws: unbalanced input records `errors` and keeps what was found. */
export function scanFile(path: string, text: string): FileScan {
  const scan: FileScan = { path, imports: [], functions: [], consts: [], types: [], errors: [] }
  try {
    read(text, scan)
  } catch (err) {
    scan.errors.push(`internal: ${err instanceof Error ? err.message : String(err)}`)
  }
  return scan
}

function read(src: string, scan: FileScan): void {
  const errors = scan.errors
  const toks = lex(src, errors)
  const N = toks.length
  const EOF: Tok = { t: 'eof', v: '', s: src.length, e: src.length, line: 0, nl: true, bol: false }
  const T = (k: number): Tok => toks[k] ?? EOF
  const isP = (k: number, v: string): boolean => { const t = T(k); return t.t === 'p' && t.v === v }
  const isId = (k: number, v?: string): boolean => { const t = T(k); return t.t === 'id' && (v === undefined || t.v === v) }
  const textOf = (a: number, b: number): string => (b <= a ? '' : collapse(src.slice(T(a).s, T(b - 1).e)))
  const resyncAt = (k: number): boolean => { const t = T(k); return t.bol && t.t === 'id' && RESYNC.has(t.v) }

  /** k at an opener ( [ {; returns the index of its closer, or of the token before a resync point / EOF (with an error). */
  const matchClose = (k: number): number => {
    let d = 0
    for (let j = k; j < N; j++) {
      const t = toks[j]!
      if (j > k && d > 0 && resyncAt(j)) {
        errors.push(`unclosed '${T(k).v}' from line ${T(k).line}, resynced at line ${t.line}`)
        return j - 1
      }
      if (t.t !== 'p') continue
      if (OPEN.has(t.v)) d++
      else if (CLOSE.has(t.v)) { d--; if (d === 0) return j }
    }
    errors.push(`unclosed '${T(k).v}' from line ${T(k).line} at end of file`)
    return N - 1
  }
  /** k at '<'; returns the index after the matching '>'. */
  const skipAngles = (k: number): number => {
    let d = 0
    for (let j = k; j < N && j < k + 2000; j++) {
      const t = toks[j]!
      if (t.t !== 'p') continue
      if (t.v === '<' || OPEN.has(t.v)) d++
      else if (t.v === '>' || CLOSE.has(t.v)) { d--; if (d === 0) return j + 1 }
      else if (t.v === ';') return j
    }
    return k + 1
  }
  const continues = (k: number): boolean => {
    const t = T(k)
    const p = T(k - 1)
    if (t.t === 'p' && CONT_AT.has(t.v)) return true
    if (p.t === 'p' && CONT_BEFORE.has(p.v)) return true
    if (p.t === 'id' && CONT_KW.has(p.v)) return true
    if (t.t === 'id' && (t.v === 'as' || t.v === 'satisfies' || t.v === 'extends')) return true
    return false
  }
  /** Reads a type from k; stops at depth 0 on ; , = closers, a body '{', '=>' (when arrow) or a statement-ending newline. */
  const readType = (k: number, end: number, opts: { body?: boolean; arrow?: boolean } = {}): number => {
    let d = 0
    let j = k
    for (; j < end; j++) {
      const t = toks[j]!
      if (d === 0) {
        if (t.t === 'p' && (t.v === ';' || t.v === ',' || t.v === '=' || CLOSE.has(t.v))) break
        if (opts.arrow && t.t === 'p' && t.v === '=>') break
        if (j > k && t.t === 'p' && t.v === '{' && opts.body) {
          const p = T(j - 1)
          if (p.t === 'id' || p.t === 'str' || p.t === 'num' || (p.t === 'p' && END_TOK.has(p.v))) break
        }
        if (j > k && t.nl && !continues(j)) break
        if (resyncAt(j)) break
      }
      if (t.t !== 'p') continue
      if (OPEN.has(t.v) || t.v === '<') d++
      else if ((CLOSE.has(t.v) || t.v === '>') && d > 0) d--
    }
    return j
  }
  /** Skips an expression from k: stops at depth 0 on ; , a closer, or a statement-ending newline. */
  const skipExpr = (k: number, end: number): number => {
    let j = k
    while (j < end) {
      const t = toks[j]!
      if (t.t === 'p' && (t.v === ';' || t.v === ',' || CLOSE.has(t.v))) return j
      if (j > k && ((t.nl && !continues(j)) || resyncAt(j))) return j
      if (t.t === 'p' && OPEN.has(t.v)) { j = matchClose(j) + 1; continue }
      j++
    }
    return j
  }
  /** An arrow function or function expression at k: its params, annotated return type and where its signature ends. */
  const fnAt = (k: number, end: number): { params: string; ret: string } | null => {
    let j = k
    if (isId(j, 'async') && (isP(j + 1, '(') || isId(j + 1) || isP(j + 1, '<'))) j++
    if (isId(j, 'function')) {
      j++
      if (isP(j, '*')) j++
      if (isId(j)) j++
      if (isP(j, '<')) j = skipAngles(j)
      if (!isP(j, '(')) return null
      const c = matchClose(j)
      const params = textOf(j + 1, c)
      let ret = ''
      if (isP(c + 1, ':')) ret = textOf(c + 2, readType(c + 2, end, { body: true }))
      return { params, ret }
    }
    if (isId(j) && isP(j + 1, '=>')) return { params: T(j).v, ret: '' }
    if (isP(j, '<')) j = skipAngles(j)
    if (!isP(j, '(')) return null
    const c = matchClose(j)
    let a = c + 1
    let ret = ''
    if (isP(a, ':')) {
      const e = readType(a + 1, end, { arrow: true })
      ret = textOf(a + 1, e)
      a = e
    }
    if (!isP(a, '=>')) return null
    return { params: textOf(j + 1, c), ret }
  }
  const op = (vis: ScanMember['visibility'], name: string, params: string, ret: string): ScanMember =>
    ({ name, text: cut(`${vis}${name}(${params})${ret ? ' ' + ret : ''}`), kind: 'operation', visibility: vis })
  const attr = (vis: ScanMember['visibility'], name: string, type: string, optional = false): ScanMember =>
    ({ name, text: cut(`${vis}${name}${optional ? '?' : ''}${type ? ': ' + type : ''}`), kind: 'attribute', visibility: vis })

  /** Members of a class, interface or object-type body in (from, to). */
  const members = (from: number, to: number, enumBody: boolean): { attributes: ScanMember[]; operations: ScanMember[] } => {
    const attributes: ScanMember[] = []
    const operations: ScanMember[] = []
    const seen = new Set<string>()
    const push = (m: ScanMember): void => {
      const key = `${m.kind}:${m.name}`
      if (seen.has(key)) return
      seen.add(key)
      ;(m.kind === 'attribute' ? attributes : operations).push(m)
    }
    let k = from
    while (k < to) {
      const start = k
      if (isP(k, ';') || isP(k, ',')) { k++; continue }
      if (isP(k, '@')) {
        k++
        while (isId(k) || isP(k, '.')) k++
        if (isP(k, '(')) k = matchClose(k) + 1
        continue
      }
      let vis: ScanMember['visibility'] = '+'
      if (enumBody) {
        const t = T(k)
        if (t.t === 'id' || t.t === 'str') push(attr('+', t.v, ''))
        k = isP(k + 1, '=') ? skipExpr(k + 2, to) : k + 1
        if (k === start) k++
        continue
      }
      while (isId(k) && MODIFIERS.has(T(k).v)) {
        const n = T(k + 1)
        const nameNext = n.t === 'id' || n.t === 'str' || n.t === 'num' || (n.t === 'p' && (n.v === '[' || n.v === '*'))
        if (!nameNext || n.nl) break
        if (T(k).v === 'private') vis = '-'
        else if (T(k).v === 'protected') vis = '#'
        k++
      }
      if (isP(k, '*')) k++
      const t = T(k)
      let name: string
      if (t.t === 'id') {
        if (t.v.startsWith('#')) { vis = '-'; name = t.v.slice(1) } else name = t.v
      } else if (t.t === 'str' || t.t === 'num') name = t.v
      else {
        // index signature, computed key, call signature or junk: skip the member
        if (isP(k, '[') || isP(k, '(')) {
          k = matchClose(k) + 1
          if (isP(k, '?')) k++
          if (isP(k, '(')) { k = matchClose(k) + 1 }
          if (isP(k, ':')) k = readType(k + 1, to, { body: true })
          if (isP(k, '{')) k = matchClose(k) + 1
          else if (isP(k, '=')) k = skipExpr(k + 1, to)
        }
        if (k === start) k++
        continue
      }
      k++
      let optional = false
      if (isP(k, '?') || isP(k, '!')) { optional = T(k).v === '?'; k++ }
      if (isP(k, '(') || isP(k, '<')) {
        if (isP(k, '<')) k = skipAngles(k)
        if (!isP(k, '(')) { k = Math.max(k, start + 1); continue }
        const c = matchClose(k)
        const params = textOf(k + 1, c)
        k = c + 1
        let ret = ''
        if (isP(k, ':')) {
          const e = readType(k + 1, to, { body: true })
          ret = textOf(k + 1, e)
          k = e
        }
        if (isP(k, '{')) k = matchClose(k) + 1
        if (name !== 'constructor') push(op(vis, name, params, ret))
      } else if (isP(k, ':')) {
        const e = readType(k + 1, to)
        const type = textOf(k + 1, e)
        k = e
        if (isP(k, '=')) k = skipExpr(k + 1, to)
        push(attr(vis, name, type, optional))
      } else if (isP(k, '=')) {
        const fn = fnAt(k + 1, to)
        if (fn) push(op(vis, name, fn.params, fn.ret))
        else push(attr(vis, name, '', optional))
        k = skipExpr(k + 1, to)
      } else {
        push(attr(vis, name, '', optional))
      }
      if (k <= start) k = start + 1
    }
    return { attributes, operations }
  }

  /** A type reference in a heritage clause at k: its last name segment and where it ends. */
  const ref = (k: number): { name: string; next: number } | null => {
    if (!isId(k)) return null
    let name = T(k).v
    let j = k + 1
    while (isP(j, '.') && isId(j + 1)) { name = T(j + 1).v; j += 2 }
    if (isP(j, '<')) j = skipAngles(j)
    if (isP(j, '(')) j = matchClose(j) + 1
    return { name, next: j }
  }
  const refList = (k: number, out: string[]): number => {
    let j = k
    for (;;) {
      const r = ref(j)
      if (!r) return j
      out.push(r.name)
      j = r.next
      if (!isP(j, ',')) return j
      j++
    }
  }

  const typeNames = new Set<string>()
  const pushType = (ty: ScanType): void => {
    if (typeNames.has(ty.name)) return
    typeNames.add(ty.name)
    scan.types.push(ty)
  }
  const named = new Set<string>()
  const pushTop = (m: ScanMember): void => {
    if (named.has(m.name)) return
    named.add(m.name)
    ;(m.kind === 'operation' ? scan.functions : scan.consts).push(m)
  }

  /** class at k ('class' keyword); returns the index after the body or -1. */
  const classDecl = (k: number, exported: boolean, abstract: boolean): number => {
    let j = k + 1
    let name = 'default'
    const line = T(k).line
    if (isId(j) && T(j).v !== 'extends' && T(j).v !== 'implements') { name = T(j).v; j++ }
    if (isP(j, '<')) j = skipAngles(j)
    const ext: string[] = []
    const impl: string[] = []
    if (isId(j, 'extends')) j = refList(j + 1, ext)
    if (isId(j, 'implements')) j = refList(j + 1, impl)
    if (!isP(j, '{')) return -1
    const c = matchClose(j)
    const m = members(j + 1, c, false)
    const ty: ScanType = { name, kind: 'class', exported, extends: ext.slice(0, 1), implements: impl, ...m, line }
    if (abstract) ty.stereotype = 'abstract'
    pushType(ty)
    return c + 1
  }
  const interfaceDecl = (k: number, exported: boolean): number => {
    if (!isId(k + 1)) return -1
    const name = T(k + 1).v
    let j = k + 2
    if (isP(j, '<')) j = skipAngles(j)
    const ext: string[] = []
    if (isId(j, 'extends')) j = refList(j + 1, ext)
    if (!isP(j, '{')) return -1
    const c = matchClose(j)
    pushType({ name, kind: 'interface', exported, extends: ext, implements: [], ...members(j + 1, c, false), line: T(k).line })
    return c + 1
  }
  const typeAlias = (k: number, exported: boolean): number => {
    if (!isId(k + 1)) return -1
    const name = T(k + 1).v
    let j = k + 2
    if (isP(j, '<')) j = skipAngles(j)
    if (!isP(j, '=')) return -1
    j++
    if (isP(j, '{')) {
      const c = matchClose(j)
      const after = c + 1
      const continued = T(after).t === 'p' && (T(after).v === '&' || T(after).v === '|' || T(after).v === '[')
      if (!continued) {
        pushType({ name, kind: 'interface', exported, stereotype: 'type', extends: [], implements: [], ...members(j + 1, c, false), line: T(k).line })
        return after
      }
    }
    return readType(j, N)
  }
  const enumDecl = (k: number, exported: boolean): number => {
    if (!isId(k + 1) || !isP(k + 2, '{')) return -1
    const c = matchClose(k + 2)
    pushType({ name: T(k + 1).v, kind: 'interface', exported, stereotype: 'enum', extends: [], implements: [], ...members(k + 3, c, true), line: T(k).line })
    return c + 1
  }
  const functionDecl = (k: number): number => {
    let j = k
    if (isId(j, 'async')) j++
    j++ // function
    if (isP(j, '*')) j++
    const name = isId(j) ? T(j).v : 'default'
    if (isId(j)) j++
    if (isP(j, '<')) j = skipAngles(j)
    if (!isP(j, '(')) return -1
    const c = matchClose(j)
    const params = textOf(j + 1, c)
    let a = c + 1
    let ret = ''
    if (isP(a, ':')) {
      const e = readType(a + 1, N, { body: true })
      ret = textOf(a + 1, e)
      a = e
    }
    if (isP(a, '{')) a = matchClose(a) + 1
    pushTop(op('+', name, params, ret))
    return a
  }
  const varDecl = (k: number): number => {
    let j = k + 1
    for (;;) {
      if (isP(j, '{') || isP(j, '[')) {
        j = matchClose(j) + 1
      } else if (isId(j)) {
        const name = T(j).v
        j++
        if (isP(j, '!')) j++
        let type = ''
        if (isP(j, ':')) {
          const e = readType(j + 1, N)
          type = textOf(j + 1, e)
          j = e
        }
        const fn = isP(j, '=') ? fnAt(j + 1, N) : null
        if (fn) {
          pushTop(op('+', name, fn.params, fn.ret))
        } else pushTop(attr('+', name, type))
      } else return j
      if (isP(j, ':')) j = readType(j + 1, N)
      if (isP(j, '=')) j = skipExpr(j + 1, N)
      if (!isP(j, ',')) return j
      j++
    }
  }
  /** A declaration at k; returns the index after it or -1 when k does not start one. */
  const declaration = (k: number, exported: boolean): number => {
    if (isId(k, 'declare')) k++
    const v = T(k).t === 'id' ? T(k).v : ''
    if (v === 'abstract' && isId(k + 1, 'class')) return classDecl(k + 1, exported, true)
    if (v === 'class') return classDecl(k, exported, false)
    if (v === 'interface') return interfaceDecl(k, exported)
    if (!exported) return -1
    if (v === 'type') return typeAlias(k, exported)
    if (v === 'enum') return enumDecl(k, exported)
    if (v === 'const' && isId(k + 1, 'enum')) return enumDecl(k + 1, exported)
    if (v === 'function' || (v === 'async' && isId(k + 1, 'function'))) return functionDecl(k)
    if (v === 'const' || v === 'let' || v === 'var') return varDecl(k)
    return -1
  }
  const addImport = (spec: string, typeOnly: boolean, reexport: boolean, line: number): void => {
    scan.imports.push({ spec, typeOnly, reexport, line })
  }
  const importStmt = (k: number): number => {
    let j = k + 1
    if (isP(j, '(') || isP(j, '.')) return -1
    let typeOnly = false
    if (isId(j, 'type') && !isId(j + 1, 'from') && !isP(j + 1, ',') && !isP(j + 1, '=')) { typeOnly = true; j++ }
    if (T(j).t === 'str') { addImport(T(j).v, typeOnly, false, T(k).line); return j + 1 }
    for (let g = 0; j < N && g < 4000; g++) {
      const t = T(j)
      if (t.t === 'id' && t.v === 'from' && T(j + 1).t === 'str') { addImport(T(j + 1).v, typeOnly, false, T(k).line); return j + 2 }
      if (t.t === 'id' || (t.t === 'p' && (t.v === '{' || t.v === '}' || t.v === ',' || t.v === '*'))) { j++; continue }
      break
    }
    return -1
  }
  const exportStmt = (k: number): number => {
    let j = k + 1
    if (isP(j, '*')) {
      j++
      if (isId(j, 'as')) j += 2
      if (isId(j, 'from') && T(j + 1).t === 'str') { addImport(T(j + 1).v, false, true, T(k).line); return j + 2 }
      return -1
    }
    let typeOnly = false
    if (isId(j, 'type') && isP(j + 1, '{')) { typeOnly = true; j++ }
    if (isP(j, '{')) {
      const c = matchClose(j)
      if (isId(c + 1, 'from') && T(c + 2).t === 'str') { addImport(T(c + 2).v, typeOnly, true, T(k).line); return c + 3 }
      return c + 1
    }
    if (isId(j, 'default')) j++
    return declaration(j, true)
  }

  let depth = 0
  const isStmtStart = (k: number): boolean => k === 0 || T(k).nl || isP(k - 1, ';') || isP(k - 1, '}')
  for (let k = 0; k < N; k++) {
    const t = toks[k]!
    if (depth > 0 && resyncAt(k)) {
      errors.push(`unbalanced brackets: ${depth} still open at line ${t.line}, resynced`)
      depth = 0
    }
    if (depth === 0 && t.t === 'id' && isStmtStart(k)) {
      let r = -1
      if (t.v === 'import') r = importStmt(k)
      else if (t.v === 'export') r = exportStmt(k)
      else if (t.v === 'class' || t.v === 'abstract' || t.v === 'interface' || t.v === 'declare') r = declaration(k, false)
      if (r > k) { k = r - 1; continue }
    }
    if (t.t !== 'p') continue
    if (OPEN.has(t.v)) depth++
    else if (CLOSE.has(t.v)) {
      if (depth === 0) errors.push(`unbalanced '${t.v}' at line ${t.line}`)
      else depth--
    }
  }
  if (depth > 0) errors.push(`unbalanced brackets: ${depth} still open at end of file`)
}

// ---------------------------------------------------------------------------------------------------------------
// assemble

/** Normalises a '/'-separated relative path; leading '..' segments are kept (out of root). */
function normalise(path: string): string {
  const out: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..' && out.length > 0 && out[out.length - 1] !== '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

const JS_TO_TS: [string, string[]][] = [['.js', ['.ts', '.tsx']], ['.jsx', ['.tsx']], ['.mjs', ['.mts']], ['.cjs', ['.cts']]]
const NO_EXT = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']

/** Package name of a bare spec: '@scope/pkg/sub' -> '@scope/pkg', 'three/addons/x.js' -> 'three'. */
function packageName(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0]!
}

type Resolved = { in: string } | { out: string } | { ext: string } | null

function resolveSpec(from: string, spec: string, known: Set<string>): Resolved {
  if (!spec.startsWith('.')) return spec.startsWith('/') ? null : { ext: packageName(spec) }
  const dir = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : ''
  const target = normalise(dir ? `${dir}/${spec}` : spec)
  if (target === '..' || target.startsWith('../')) return { out: target }
  for (const [js, tss] of JS_TO_TS) {
    if (!target.endsWith(js)) continue
    for (const ts of tss) {
      const cand = target.slice(0, -js.length) + ts
      if (known.has(cand)) return { in: cand }
    }
  }
  if (known.has(target)) return { in: target }
  for (const ext of NO_EXT) if (known.has(target + ext)) return { in: target + ext }
  return null
}

const baseName = (path: string): string => {
  const file = path.slice(path.lastIndexOf('/') + 1)
  const dot = file.lastIndexOf('.')
  return dot > 0 ? file.slice(0, dot) : file
}

/** Type text of an attribute member: what follows its name and ':' in `text`. */
const attrType = (m: ScanMember): string => {
  const i = m.text.indexOf(':')
  return i === -1 ? '' : m.text.slice(i + 1)
}

/** Turns file scans into one design: modules with resolved deps, types, and dependency/type relations. */
export function assemble(files: FileScan[], root: string): ActualDesign {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const known = new Set(sorted.map((f) => f.path))
  const design: ActualDesign = { root, modules: {}, types: {}, relations: [], skipped: [], truncated: false }
  const typeRels: ActualRelation[] = []
  const byName = new Map<string, string[]>()

  for (const f of sorted) {
    const mod: ActualModule = { path: f.path, name: baseName(f.path), functions: f.functions, consts: f.consts, deps: [], reexports: [], outside: [], externals: [] }
    const typeOnly = new Map<string, boolean>()
    for (const imp of f.imports) {
      const r = resolveSpec(f.path, imp.spec, known)
      if (!r) continue
      if ('ext' in r) { if (!mod.externals.includes(r.ext)) mod.externals.push(r.ext); continue }
      if ('out' in r) { if (!mod.outside.includes(r.out)) mod.outside.push(r.out); continue }
      if (r.in === f.path) continue
      if (!mod.deps.includes(r.in)) mod.deps.push(r.in)
      if (imp.reexport && !mod.reexports.includes(r.in)) mod.reexports.push(r.in)
      typeOnly.set(r.in, (typeOnly.get(r.in) ?? true) && imp.typeOnly)
    }
    for (const dep of mod.deps) {
      const rel: ActualRelation = { from: f.path, to: dep, kind: 'dependency' }
      if (typeOnly.get(dep)) rel.typeOnly = true
      design.relations.push(rel)
    }
    design.modules[f.path] = mod
    for (const t of f.types) {
      const id = `${f.path}#${t.name}`
      if (design.types[id]) continue
      const ty: ActualType = { id, module: f.path, name: t.name, kind: t.kind, exported: t.exported, attributes: t.attributes, operations: t.operations }
      if (t.stereotype) ty.stereotype = t.stereotype
      design.types[id] = ty
      byName.set(t.name, [...(byName.get(t.name) ?? []), id])
    }
  }

  /** same module first, then a unique name across the scan */
  const resolveType = (module: string, name: string): string | undefined => {
    const local = `${module}#${name}`
    if (design.types[local]) return local
    const all = byName.get(name)
    return all && all.length === 1 ? all[0] : undefined
  }
  const seen = new Set<string>()
  const pushRel = (from: string, kind: ActualRelation['kind'], to: string | undefined): void => {
    if (!to || to === from) return
    const key = `${from}|${kind}|${to}`
    if (seen.has(key)) return
    seen.add(key)
    typeRels.push({ from, to, kind })
  }
  for (const f of sorted) {
    for (const t of f.types) {
      const id = `${f.path}#${t.name}`
      for (const e of t.extends) pushRel(id, 'generalization', resolveType(f.path, e))
      for (const i of t.implements) pushRel(id, t.kind === 'class' ? 'realization' : 'generalization', resolveType(f.path, i))
      for (const a of t.attributes) {
        for (const word of attrType(a).match(/[A-Za-z_$][\w$]*/g) ?? []) {
          if (byName.has(word)) pushRel(id, 'association', resolveType(f.path, word))
        }
      }
    }
  }
  design.relations.push(...typeRels)
  return design
}

// ---------------------------------------------------------------------------------------------------------------
// collectSources

const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor', 'test', 'tests', '__tests__'])
const EXCLUDED_FILE = /\.d\.[mc]?ts$|\.(test|spec)\.[^.]+$/

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * Walks `root` through `fs` in sorted order and scans its source files, honouring SCAN_LIMITS.
 * With `prev`, files whose (mtimeMs, size) did not change are reused without a read. Never rejects.
 */
export async function collectSources(root: string, fs: SourceFs, opts: { prev?: Record<string, ScannedFile> } = {}): Promise<CollectResult> {
  const res: CollectResult = { files: {}, skipped: [], truncated: false, read: 0 }
  const base = root.replace(/\/+$/, '')
  const full = (rel: string): string => (rel ? `${base}/${rel}` : base)
  let fileCount = 0
  let bytes = 0
  let entries = 0
  let stopped = false
  const limit = (path: string): void => {
    res.skipped.push({ path, reason: 'limit' })
    res.truncated = true
    stopped = true
  }
  const walk = async (rel: string, depth: number): Promise<void> => {
    let list: SourceEntry[]
    try {
      list = await fs.list(full(rel))
    } catch (err) {
      res.skipped.push({ path: rel, reason: `list: ${message(err)}` })
      return
    }
    const sorted = [...list].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const e of sorted) {
      if (stopped) return
      const path = rel ? `${rel}/${e.name}` : e.name
      if (++entries > SCAN_LIMITS.entries) { limit(path); return }
      if (e.kind === 'directory') {
        if (e.name.startsWith('.') || EXCLUDED_DIRS.has(e.name)) { res.skipped.push({ path, reason: 'excluded' }); continue }
        if (depth + 1 > SCAN_LIMITS.depth) { res.skipped.push({ path, reason: 'limit' }); res.truncated = true; continue }
        await walk(path, depth + 1)
        continue
      }
      if (e.kind !== 'file' || !SOURCE_EXT.test(e.name)) continue
      if (e.name.startsWith('.') || EXCLUDED_FILE.test(e.name)) { res.skipped.push({ path, reason: 'excluded' }); continue }
      if (e.size > SCAN_LIMITS.bytesPerFile) { res.skipped.push({ path, reason: 'too-large' }); continue }
      if (fileCount + 1 > SCAN_LIMITS.files || bytes + e.size > SCAN_LIMITS.totalBytes) { limit(path); return }
      const prev = opts.prev?.[path]
      if (prev && prev.mtimeMs === e.mtimeMs && prev.size === e.size) {
        res.files[path] = prev
      } else {
        res.read++
        let text: string
        try {
          text = await fs.read(full(path))
        } catch (err) {
          res.skipped.push({ path, reason: `read: ${message(err)}` })
          continue
        }
        res.files[path] = { mtimeMs: e.mtimeMs, size: e.size, scan: scanFile(path, text) }
      }
      fileCount++
      bytes += e.size
    }
  }
  try {
    await walk('', 0)
  } catch (err) {
    res.skipped.push({ path: '', reason: `walk: ${message(err)}` })
  }
  return res
}

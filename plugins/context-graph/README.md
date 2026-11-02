# context-graph

A Claude Code mod that draws the live context window as a 3D graph and highlights the **blast radius** of the
latest question: the nodes the question reaches (the turns it caused, the tools those turns ran and the files they
touched), fading with hop distance. The camera frames the blast radius.

- **Nodes**: system and context segments, user prompts, assistant turns, tool calls, files read or edited, and
  compaction summaries. A node's size is proportional to its tokens; nodes compacted out of the window are dimmed.
- **Edges**: prompt → turn → tool → file.
- **Math only from three.js**: `Vector3`, `Matrix4` and the perspective projection are vendored under
  `vendor/three-math` (three@0.170.0, MIT) and imported statically. Nothing runs WebGL, touches the DOM or loads a CDN
  inside the pane.

## How the graph is built

Hooks keep it current without any action from you:

| Hook | What it adds |
| --- | --- |
| `session.start` | Registers the command and the tool. If the graph is empty it rebuilds it from the transcript (`~/.claude/projects/<cwd>/<session>.jsonl`), or from `$.session.messages()` when the transcript cannot be read. After a reload the existing graph is kept. |
| `session.append` | Prompts, turns, tool calls and files, row by row. Subagent rows are skipped because they are not in this window. |
| `prompt.submit` | Points the blast radius back at the new question. |
| `tool.call` | Marks failed tools and serves the `context_graph` tool. |
| `turn.complete` | Uses the response's token usage to size the turn. |
| `session.compact` | Adds a compaction node and moves the older nodes out of the window. |

Every hook calls `next` exactly once and returns its result, including when the input is malformed. The mod never
denies, drops or rewrites a tool call, prompt or row.

## Command: `/context-graph`

| Subcommand | Effect |
| --- | --- |
| `open` (default) | Opens the pane. |
| `focus <text>` | Seeds the blast radius from nodes matching the text. A file path or basename such as `a.ts` picks that file. |
| `clear` | Returns the focus to the latest prompt. |
| `stats` | Node counts by kind, and the blast radius in nodes and tokens out of the window total. |
| `export [path]` | Writes a standalone HTML page with a WebGL three.js view. It defaults to `<cwd>/context-graph.html`. |
| `reset` | Empties the graph. |

## Tool for the model: `context_graph`

The mod registers `mcp__context-graph__context_graph` (not deferred), so the model can steer the view:

- `{ "action": "inspect" }` returns JSON listing up to 25 reached nodes, each with id, kind, label, tokens, inWindow,
  hop and weight, plus the blast and window totals.
- `{ "action": "focus", "match": "a.ts", "nodeIds": ["tool:tu1"], "note": "why the test fails" }` seeds the blast
  radius from those nodes. Unknown ids are reported back, not thrown. The note appears in the pane's status line.
- `{ "action": "clear" }` returns the focus to the latest prompt.

## Export

`/context-graph export [path]` writes one HTML file containing the graph, the layout and the blast radius. Open it in
a browser for an orbitable WebGL view. The page loads three@0.170.0 from cdn.jsdelivr.net, so it needs network
access.

## Surfaces

| Surface | Drawing |
| --- | --- |
| desktop, vscode, mobile | `Svg`: depth-sorted circles and edges with blast halos and labels. |
| terminal | `Raster`: braille cells. With auto-orbit on, it is redrawn with `$.ui.blit` on each clock tick. |
| anything else | A text list of the ten heaviest blast-radius nodes. |

The pane has buttons for yaw (◀ ▶), pitch (▲ ▼), zoom (+ −, limited to 0.25× to 4×), auto-orbit (⟳) and refocus
(◎). Under them are a view line and a status line in the form
`N nodes · blast: k nodes / T tok of W window · focus: auto|model "note"`.

## Install

From the marketplace in this repository:

```sh
claude plugin marketplace add earthlingollie/context-management
claude plugin install context-graph@earthlingollie
```

As a development mod in the current session, which copies only `.claude-plugin`, `hooks`, `src`, `types` and
`vendor`:

```sh
npm run install-dev -- <session-id>   # -> ~/.claude/dev-mods/<session-id>/context-graph
```

## Develop

Use Node 22 or later. TypeScript runs directly under `node --test`.

```sh
npm test            # node:test suites for the core (ingest, blast, layout, camera, scene, svg, raster, export, live)
npm run test:mod    # claude plugin test on a staged copy (hooks/register.test.tsx)
npm run typecheck   # tsc for the core and for the mod shell
npm run validate    # claude plugin validate .
npm run check       # all four
```

`tsconfig.mod.json` needs the engine types at `.claude-plugin/types/claude-code/index.d.ts`, which is gitignored.
Create them with `npm run types -- <path to plugin-authoring/types/claude-code.d.ts>`.

## License

MIT. The vendored three.js math is MIT, and its licence is in `vendor/three-math/LICENSE`.

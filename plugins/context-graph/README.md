# context-graph

A Claude Code mod that draws **the shape of the solution** Claude is building, over the live context window as its
evidence. Version 0.2.0.

- **Solution layer** (on top): the goal at the centre; components; factors (requirements, constraints, assumptions,
  dependencies, risks); decisions, linked to the factors that drove them; open questions, drawn hollow and dashed
  until they are resolved. Edges: `depends-on`, `constrains`, `decided-by`, `contradicts`, `supported-by`.
- **Evidence layer** (below): the transcript graph (prompts, assistant turns, tool calls, files, compactions),
  demoted to a supporting disc. Each solution node links down to the transcript nodes that support it.
- **Grows each turn**: nodes added since the current prompt grow in; resolved questions go solid; abandoned
  approaches fade and are struck through, but stay.
- **Focus**: the parts of the solution the current question touches, and the factors bearing on them, stay bright;
  the rest fades. The model can set the focus explicitly; otherwise it follows the latest prompt's blast radius.
- **Context health** per solution node, as a ring: its evidence is in the window (solid), compacted out (dashed) or
  was never loaded (grey, with a dot).
- **Math only from three.js** inside the mod: `Vector3`, `Matrix4` and the perspective projection are vendored under
  `vendor/three-math` (three@0.170.0, MIT). Nothing in the pane runs WebGL, touches the DOM or loads a CDN.

## Who writes the model

Claude does, through the `context_graph` tool (`mcp__context-graph__context_graph`, not deferred). The model is kept
in mod state, persisted, and written to `<cwd>/.context-graph/solution.json` so it survives a restart.

| Action | Input | Effect |
| --- | --- | --- |
| `add` | `kind`, `label`, optional `id`, `detail`, `evidence[]` | Adds or updates a goal, component, factor, decision or question. `evidence` ids (from `inspect`) become `supported-by` edges. |
| `link` | `from`, `to`, `kind` | Adds an edge: `depends-on`, `constrains`, `decided-by`, `contradicts`, or `supported-by` to a transcript id. |
| `resolve` | `id`, optional `by`, `note`, `evidence[]` | Marks a question or risk resolved; `by` adds a `decided-by` edge to the deciding decision. |
| `abandon` | `id`, `reason` | Marks an approach abandoned. It fades but stays. |
| `import` | `path` or `ops[]`, optional `mode` (`merge`/`replace`) | Loads a `context-graph/solution@1` seed file or an inline op list. |
| `inspect` | | Returns the model, what the current question touches and bears on, and up to 15 evidence nodes with ids. |
| `focus` | `match`, `nodeIds[]`, `note` | Focuses solution or transcript nodes. The note appears in the pane. |
| `clear` | | Returns the focus to the latest prompt. |

Every call answers with JSON (`ok`, the node id or an error naming the field, model counts and the export state).
Bad input is reported back, never thrown.

## The Artifact loop (claude.ai web)

claude.ai web does not show mod panes, so the view also lives in a claude.ai Artifact:

1. On `turn.complete`, when the model, the compaction count or the focus changed, the mod writes the solution page
   to the export path (default `<cwd>/.context-graph/solution.html`) and the model to `solution.json` beside it.
2. Claude republishes that file with the Artifact tool to the same URL, so the page is always the latest shape.

The page is an Artifact-safe fragment (no doctype, html, head or body tags of its own; `--document` adds them),
titled *Context Window Graph*. It loads three.js only from `cdn.jsdelivr.net/npm/three@0.170.0` and renders both
layers with WebGL: orbit, hover tooltips, a focus button, a layers toggle (both, solution, evidence), a replay of the
model growing in creation order, and one button per open question that flies the camera to it. It follows the light
or dark theme.

## Hooks

Every hook calls `next` exactly once and returns its result, including when the input is malformed. The mod never
denies, drops or rewrites a tool call, prompt or row.

| Hook | What it does |
| --- | --- |
| `session.start` | Registers the command and the tool and opens the pane. Rebuilds the evidence graph from the transcript (`~/.claude/projects/<cwd>/<session>.jsonl`) or from `$.session.messages()` when it is empty, and restores the model from `.context-graph/solution.json`. |
| `session.append` | Prompts, turns, tool calls and files, row by row. Subagent rows are skipped. |
| `prompt.submit` | Points the focus back at the new question and records where it began (what is new grows in). |
| `tool.call` | Marks failed tools and serves the `context_graph` tool. |
| `turn.complete` | Sizes the turn from its token usage, then writes the Artifact page and `solution.json`. |
| `session.compact` | Adds a compaction node and moves older nodes out of the window (health rings turn dashed). |

## Command: `/context-graph`

| Subcommand | Effect |
| --- | --- |
| `open` (default) | Opens the pane. |
| `focus <text>` | Focuses nodes matching the text (solution labels, transcript labels, file paths). |
| `clear` | Returns the focus to the latest prompt. |
| `stats` | Node counts by kind, and the focus in nodes and tokens out of the window total. |
| `export [path] [--document]` | Writes the solution page now, to `path` or the export path. |
| `export-path <path>` | Sets where `turn.complete` writes the page. |
| `import <path> [--replace]` | Loads a seed file into the model. |
| `model` | Prints the model as an outline: open `[ ]`, resolved `[x]`, abandoned struck through. |
| `reset` | Empties the evidence graph. |
| `help` | Lists the subcommands. |

## Surfaces

| Surface | Drawing |
| --- | --- |
| desktop, vscode, mobile | `Svg`: the solution layer (shapes by kind, status, health rings, labels) over the evidence disc, with a header (`GOAL … · n components · n decisions · n open questions · health …`) and a legend. Large models degrade evidence first, then labels and edges, never solution nodes. |
| terminal | `Raster`: a glyph per solution kind over dim evidence dots. With auto-orbit on, it is redrawn with `$.ui.blit`. |
| anything else | Text: the goal, open questions and what the current question touches. |

The pane has buttons for yaw (◀ ▶), pitch (▲ ▼), zoom (+ −), auto-orbit (⟳), refocus (◎) and layers (◫), then a view
line, a status line with the export state, and a stats line. It follows the light or dark theme from `/config`.

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
npm test            # node:test suites for the core (solution, toolInput, relevance, health, layers, scene, svg, raster, export, ...)
npm run test:mod    # claude plugin test on a staged copy (hooks/register.test.tsx)
npm run typecheck   # tsc for the core and for the mod shell
npm run validate    # claude plugin validate .
npm run check       # all four
npm run smoke -- <outdir> [--three <three@0.170.0 package dir>]        # the Artifact page in headless chromium
npm run acceptance -- <seed.json> <transcript.jsonl> <outdir> [--three <dir>]
```

`npm run acceptance` imports a seed model against a real transcript, checks it, and writes `solution.svg`,
`solution.html`, `solution.png` (the WebGL page), `pane.svg` and `pane.png` to the outdir. `--three` serves three.js
from a local copy where cdn.jsdelivr.net is blocked.

`tsconfig.mod.json` needs the engine types at `.claude-plugin/types/claude-code/index.d.ts`, which is gitignored.
Create them with `npm run types -- <path to plugin-authoring/types/claude-code.d.ts>`.

## License

MIT. The vendored three.js math is MIT, and its licence is in `vendor/three-math/LICENSE`.

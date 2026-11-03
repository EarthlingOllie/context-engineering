# context-graph

A Claude Code mod that draws **the shape of the solution** Claude is building, over the live context window as its
evidence, and **the UML design emerging decision by decision**, cross-checked against the code. Version 0.3.0.

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
| `import <path> [--replace]` | Loads a seed file (@1, or @2 with UML) into the models: `Imported n ops (k failed, d dangling, u UML changes).` |
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

## v3: the UML design (main view)

The main view is a UML component + class diagram that grows as decisions are made. Claude records the **intended**
design; a lightweight scan of the source records the **actual** one; every intended element is flagged against it.

### Tool actions

| Action | Input | Effect |
| --- | --- | --- |
| `uml.add` | `decision`, `kind` (`component`/`class`/`interface`), `name`, optional `id`, `stereotype`, `in` (owning component), `code`, `note`, `attributes[]`, `operations[]` | Adds an element, or merges members into it. `in` also adds a composition. |
| `uml.relate` | `decision`, `kind` (`association`/`dependency`/`realization`/`composition`/`generalization`), `from`, `to`, optional `label` | Adds a relation between two elements. |
| `uml.remove` | `decision`, `reason`, and `id`, `id` + `member`, or `from` + `kind` + `to` | Removes an element, one member or a relation. It stays drawn, dashed and struck. |
| `uml.scan` | optional `root` | Rescans the code (and persists the root); replies with the cross-check lists. |

Every UML change cites the decision that causes it (add the decision first: an unknown one fails with
`unknown-decision`). **Abandoning a decision** removes the UML it introduced, as one "abandoned" step. `inspect` adds
`uml: { steps, latest, elements, counts, plannedNotBuilt, builtNotPlanned, decisionsWithoutUml }`; `import` takes
`context-graph/solution@2` seeds (solution and `uml.*` ops) as well as @1.

### Code refs

`code` says where an element lives, relative to the scan root: a module `core/svg.ts`, a type `core/svg.ts#SvgOptions`,
a folder `core/`, a path outside the root `../vendor/three-math` (matched through the modules that import it), a package
`npm:three`, or `none` (not checkable). Without `code`, the element is matched by name.

### Flags

| Flag | Mark | Meaning |
| --- | --- | --- |
| `matching` | ✓ | In the code as recorded. A missing planned member shows with ◌. |
| `planned-not-built` | ◌ | Recorded, not in the code (amber, dashed). |
| `built-not-planned` | + | In the code, never recorded (grey, dotted; latest step only). |
| `removed-but-built` | ! | Removed or abandoned in the design, still in the code (red). |
| `unchecked` | ? | Not checkable from the scan root (`none`, or outside the root and imported by nothing). |

### Timeline

Each run of UML changes with the same decision is one **step**. Step *k* shows the design after decision *k* and
highlights what it changed: added, changed, removed. The pane steps with ◀ ▶, jumps to the latest with ⏭, cycles the
built-not-planned components (components, all, none) with +, and toggles to the v2 solution graph with ◫ (◧ back).
Its status line reads `Step k/N · <decision> · +added ~changed −removed · ✓ ◌ + ! ? · export: <path> (written hh:mm:ss)`.
Desktop, vscode and mobile draw a layered box-and-arrow `Svg`; the terminal draws a `Raster`; other surfaces get text.
Until Claude records UML the pane shows the solution graph with the hint *No UML yet*.

### The Artifact loop with UML

`turn.complete` writes `solution.html` with two tabs: **UML design** (Mermaid 11.4.1 `classDiagram` from
`cdn.jsdelivr.net`, re-rendered per step with a slider, ◀ ▶, play, change chips, the cross-check panel and an
`unplanned` select; a static SVG fallback when Mermaid cannot load) and **3D solution map** (the v2 page). The
diagram is drawn at natural size in a scrollable box: each step opens zoomed (never below 11.5 px names) and scrolled to
what it changed and what the cross-check flags, with everything else faded and changed relations (and their labels)
highlighted. When the full diagram cannot frame all of that at a readable size, the step opens on a focused view: the
changed elements, the flagged ones and up to 8 of their neighbours (names only above 6), left-to-right or top-to-bottom,
whichever frames more; "full diagram" switches back. Anything still outside the view gets an edge marker that scrolls to
it, as do the cross-check panel's entries. − + fit and changes buttons re-zoom. Above 12 elements only the changed
elements list their members (planned-not-built ones always show, and titles carry ◌ + ! badges); "all members" shows
them all. A legend under the buttons counts the step's flags; ◌ counts planned members too, as the header does. It writes
`solution.json` as an @2 seed once there is UML (a model without UML keeps the @1 seed). The page is rewritten when the
solution, the UML, the compaction count, the focus or the scan key changes. Claude republishes it to the same Artifact
URL; the mod never publishes.

### Scan root

The scan reads TypeScript and JavaScript sources under the root (default `<cwd>/src` when it exists, else `<cwd>`;
set it with `uml.scan root` or `/context-graph uml-root <path>`), skipping tests, `.d.ts`, dot folders and
`node_modules`, `dist`, `build`, `coverage`, `vendor` and test folders, within `SCAN_LIMITS` (400 files, 256 KiB per file, 4 MiB, depth 8). It is incremental: session start
scans once, every turn rescans and rereads only files whose mtime or size changed, and the `scan` state is written
only when the tree changed. A failing listing is recorded as `scan.error`, never thrown.

| Subcommand | Effect |
| --- | --- |
| `uml` | The design at the latest step: `[flag] kind name (code)` with members, relations, then the cross-check lists. |
| `uml-root <path>` | Sets the scan root and rescans. |
| `scan` | Rescans now and prints the `uml.scan` summary. |
| `step <n\|latest>` | Moves the pane to step n (clamped) or the latest step. |

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
npm run mermaid-check -- --mermaid <mermaid@11.4.1 package dir>       # every emitted diagram renders in real Mermaid
npm run acceptance:uml -- <seed.json> <transcript.jsonl> <srcRoot> <outdir> [--three <dir>] [--mermaid <dir>] [--baseline <rev>]
```

`npm run acceptance` imports a seed model against a real transcript, checks it, and writes `solution.svg`,
`solution.html`, `solution.png` (the WebGL page), `pane.svg` and `pane.png` to the outdir. `--three` serves three.js
from a local copy where cdn.jsdelivr.net is blocked.

`npm run acceptance:uml` replays a design seed (format @2) as the decision timeline, scans `<srcRoot>`, cross-checks
the latest step (and, with `--baseline`, the code at that git revision), then drives the Artifact page in Chromium
through every step (slider, ◀ ▶, theme, unplanned filter, 3D tab, 390 px, a 404 Mermaid URL for the static fallback).
It writes `steps/NN.mmd`, `crosscheck.json`, `pane-uml.svg`, `pane-uml-dark.svg`, `pane-uml.txt`, `solution.html`,
`uml.png`, `uml-dark.png`, `uml-step2.png`, `3d.png`, `step-start.png`, `step-middle.png`, `step-end.png`, `pane.png`.

`tsconfig.mod.json` needs the engine types at `.claude-plugin/types/claude-code/index.d.ts`, which is gitignored.
Create them with `npm run types -- <path to plugin-authoring/types/claude-code.d.ts>`.

## License

MIT. The vendored three.js math is MIT, and its licence is in `vendor/three-math/LICENSE`.

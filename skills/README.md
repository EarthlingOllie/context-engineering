# skills

A skills-only plugin: standalone skills that are not part of a larger plugin like `graph-orchestrator`. It ships through the same `earthlingollie` marketplace, so anyone who has the marketplace gets these skills and their updates the same way they get the plugins.

## Layout

```
.claude-plugin/plugin.json             the manifest (no version on purpose, see below)
skills/<skill-name>/SKILL.md           one folder per skill, auto-discovered
skills/<skill-name>/<anything else>    supporting files the skill references
```

Skills are namespaced by the plugin, so `skills/my-skill/SKILL.md` is invoked as `/skills:my-skill` (and Claude can also pick it up from its `description`).

## Skills

| Skill | What it does | Origin |
|---|---|---|
| `forge-diff` | Works through a set of findings, fixing each test-first. | This repo |
| `root-cause-analysis` | Root cause analysis with hypotheses tested in isolated worktrees. | This repo |
| `test-driven-development` | Red, green, mutate, refactor workflow. | This repo |
| `test-end-to-end` | User stories for every path through the diff, filled in as Playwright tests. | This repo |
| `code-review` | Two-axis review of the diff since a fixed point: Standards and Spec, run as parallel sub-agents. Evaluator roles can name it. | Copied from [mattpocock/skills](https://github.com/mattpocock/skills) v1.2.3 under the MIT licence (notice in `skills/code-review/LICENSE`), adjusted only to work without the rest of that plugin |

## Add a skill

1. Create `skills/<skill-name>/SKILL.md` with `name` and `description` frontmatter.
2. Commit and push to `main`. Nothing else to register: the plugin discovers every folder under `skills/`.

## Updates

`plugin.json` deliberately has no `version`. Without one, Claude Code uses the git commit as the plugin's version, so every push to `main` is picked up when the marketplace refreshes. If a `version` is ever added, it has to be bumped on every change or installs will not see the new skills.

## Install

```
claude plugin marketplace add earthlingollie/context-engineering
claude plugin install skills@earthlingollie
```

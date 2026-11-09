# skill-eval

A minimal harness to evaluate any Claude Code skill and hill-climb its `SKILL.md`.

- **Inspect AI** runs the eval: each case gets a fresh working directory, the skill is installed into it, and `claude -p "/<skill> <prompt>"` runs headlessly. A grader scores the output and writes feedback.
- **GEPA** runs the hill climb: it reads the grader feedback on failing cases, has Claude rewrite the skill's instructions, and keeps candidates that score better on the validation cases.

Every model call (the skill, the judge, the reflection step) goes through the `claude` CLI, so no separate API key is needed.

## Setup

```bash
cd skill-eval
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
```

## Write cases

One JSON object per line. See `examples/release-note/cases.jsonl`.

| Field | Meaning |
|---|---|
| `id` | Unique case name |
| `prompt` | Passed to the skill as its arguments |
| `expected` | Reference answer. For `contains`, the text that must appear |
| `grader` | `judge` (LLM judge with a rubric, the default) or `contains` |
| `rubric` | What a good answer must do. The judge's feedback against it is what GEPA learns from |
| `repo` | Optional fixture directory, relative to the case file. It's copied in as the working directory for each run |
| `split` | `train` (GEPA reflects on these), `val` (GEPA selects on these), `holdout` (scored once at the end) |

## Evaluate a skill

```bash
inspect eval skill_eval/task.py --model none --epochs 3 \
  -T skill=examples/release-note/skill \
  -T cases=examples/release-note/cases.jsonl
inspect view          # browse transcripts, scores and judge feedback
```

`--model none` is there because the skill runs through Claude Code, not an Inspect model. Add `-T split=train` to run one split, or `-T allowed_tools=Read,Grep,Glob,Bash` to let the skill use more tools. Headless runs deny any tool that isn't listed.

## Hill-climb a skill

```bash
python -m skill_eval.optimize examples/release-note/skill examples/release-note/cases.jsonl \
  --epochs 2 --budget 30 --minibatch 3
```

This writes `runs/<skill>/` containing:
- `best/<skill>/`: the best skill found
- `best.diff`: the changes against the original
- `summary.json`: validation and holdout scores for the original and the best version, plus cost
- `inspect-logs/`: every evaluation, which you can browse with `inspect view --log-dir runs/<skill>/inspect-logs`

`--budget` caps the number of case evaluations GEPA spends. Each evaluation runs the skill `--epochs` times, and judge-graded cases make one more call per run.

## Example result

`examples/release-note` starts with a deliberately weak one-line skill. One run with `--epochs 1 --budget 20 --minibatch 2` tried 4 candidates in a few minutes. The skill runs cost $2.66; judge and reflection calls are extra and not tracked:

| | Original | Best |
|---|---|---|
| Validation | 0.08 | 1.00 |
| Holdout | 0.03 | 0.93 |

The optimized skill is in `examples/release-note/optimized-SKILL.md`. It also shows overfitting: it copies a phrase from a training answer ("Updated developer linting tools") into its examples. Read every diff before adopting it.

## Limits of this minimal version

- **No container isolation.** Runs use temporary directories on the host. Your user-level `~/.claude` settings, skills and CLAUDE.md still load. Use an Inspect Docker sandbox for real isolation.
- **Small numbers are noisy.** With 2 validation cases and 1 epoch, a result like 1.0 means little. For real skills use 10+ validation cases and 3+ epochs, and trust the holdout score.
- **Only the SKILL.md body is optimized.** The frontmatter and supporting files are left as they are.
- **The judge is not calibrated.** Before optimizing against an LLM judge, check that it agrees with your own labels.

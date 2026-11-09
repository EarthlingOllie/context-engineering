"""Hill-climb a skill's SKILL.md with GEPA, scoring each candidate with the Inspect task.

    python -m skill_eval.optimize examples/release-note/skill examples/release-note/cases.jsonl \
        --epochs 2 --budget 30

Only the body of SKILL.md is optimized. The frontmatter (name, description) and
any other files in the skill directory are kept as they are.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import shutil
import statistics
import tempfile
from collections import defaultdict
from pathlib import Path

import gepa
from gepa import EvaluationBatch
from inspect_ai import eval as inspect_eval

from skill_eval.claude import run_claude_sync
from skill_eval.task import SCORER_NAME, load_cases, skill_eval

COMPONENT = "skill_instructions"


def split_frontmatter(text: str) -> tuple[str, str]:
    match = re.match(r"^(---\n.*?\n---\n)(.*)$", text, re.DOTALL)
    return (match.group(1), match.group(2)) if match else ("", text)


class SkillAdapter:
    """GEPA adapter: GEPA proposes SKILL.md bodies, Inspect scores them."""

    # None tells GEPA to use its built-in reflective proposer with `reflection_lm`.
    propose_new_texts = None

    def __init__(self, skill_dir: Path, cases_path: Path, epochs: int, log_dir: Path, task_args: dict):
        self.skill_dir = skill_dir
        self.frontmatter, _ = split_frontmatter((skill_dir / "SKILL.md").read_text())
        self.cases_path = cases_path
        self.epochs = epochs
        self.log_dir = log_dir
        self.task_args = task_args
        self.total_cost = 0.0

    def materialize(self, candidate: dict[str, str], dest: Path) -> Path:
        shutil.copytree(self.skill_dir, dest, dirs_exist_ok=True)
        (dest / "SKILL.md").write_text(self.frontmatter + candidate[COMPONENT])
        return dest

    def evaluate(self, batch: list[dict], candidate: dict[str, str], capture_traces: bool = False):
        with tempfile.TemporaryDirectory(prefix="skill-eval-cand-") as tmp:
            skill = self.materialize(candidate, Path(tmp) / self.skill_dir.name)
            [log] = inspect_eval(
                skill_eval(skill=str(skill), cases=str(self.cases_path), **self.task_args),
                model="none",
                sample_id=[c["id"] for c in batch],
                epochs=self.epochs,
                display="none",
                log_dir=str(self.log_dir),
            )
        if log.status != "success":
            raise RuntimeError(f"Inspect eval failed: {log.error}")

        runs: dict[str, list[dict]] = defaultdict(list)
        for sample in log.samples or []:
            score = sample.scores[SCORER_NAME]
            runs[str(sample.id)].append(
                {"output": sample.output.completion, "score": float(score.value), "feedback": score.explanation or ""}
            )
            self.total_cost += float(sample.metadata.get("cost_usd", 0.0))

        outputs, scores, trajectories = [], [], []
        for case in batch:
            case_runs = runs.get(str(case["id"]), [])
            mean_score = statistics.mean(r["score"] for r in case_runs) if case_runs else 0.0
            outputs.append(case_runs)
            scores.append(mean_score)
            trajectories.append({"task": case["prompt"], "score": mean_score, "runs": case_runs})
        return EvaluationBatch(outputs=outputs, scores=scores, trajectories=trajectories if capture_traces else None)

    def make_reflective_dataset(self, candidate, eval_batch, components_to_update):
        records = []
        for traj in eval_batch.trajectories or []:
            if not traj["runs"]:
                continue
            worst = min(traj["runs"], key=lambda r: r["score"])
            records.append(
                {
                    "Inputs": {"task given to the skill": traj["task"]},
                    "Generated Outputs": worst["output"][-4000:],
                    "Feedback": (
                        f"Mean score {traj['score']:.2f} over {len(traj['runs'])} runs. "
                        f"Grader feedback on the lowest-scoring run: {worst['feedback']}"
                    ),
                }
            )
        return {name: records for name in components_to_update}


def mean_score(adapter: SkillAdapter, cases: list[dict], candidate: dict[str, str]) -> float:
    return statistics.mean(adapter.evaluate(cases, candidate).scores) if cases else float("nan")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("skill", type=Path, help="skill directory containing SKILL.md")
    parser.add_argument("cases", type=Path, help="JSONL case file with train/val/holdout splits")
    parser.add_argument("--epochs", type=int, default=3, help="runs per case per evaluation")
    parser.add_argument("--budget", type=int, default=40, help="max case evaluations GEPA may spend")
    parser.add_argument("--minibatch", type=int, default=3, help="cases per reflection step")
    parser.add_argument("--out", type=Path, default=None, help="output directory (default runs/<skill>)")
    parser.add_argument("--allowed-tools", default="Read,Grep,Glob")
    parser.add_argument("--model", default=None, help="model the skill runs on")
    parser.add_argument("--judge-model", default=None)
    parser.add_argument("--reflection-model", default=None)
    args = parser.parse_args()

    skill_dir = args.skill.resolve()
    out = (args.out or Path("runs") / skill_dir.name).resolve()
    out.mkdir(parents=True, exist_ok=True)

    cases = load_cases(args.cases)
    train = [c for c in cases if c.get("split") == "train"]
    val = [c for c in cases if c.get("split") == "val"] or train
    holdout = [c for c in cases if c.get("split") == "holdout"]
    if not train:
        raise SystemExit("No cases with split 'train' in the case file.")

    adapter = SkillAdapter(
        skill_dir,
        args.cases.resolve(),
        args.epochs,
        out / "inspect-logs",
        {"allowed_tools": args.allowed_tools, "model": args.model, "judge_model": args.judge_model},
    )
    _, seed_body = split_frontmatter((skill_dir / "SKILL.md").read_text())
    seed = {COMPONENT: seed_body}

    result = gepa.optimize(
        seed_candidate=seed,
        trainset=train,
        valset=val,
        adapter=adapter,
        reflection_lm=lambda prompt: run_claude_sync(str(prompt), model=args.reflection_model),
        reflection_minibatch_size=args.minibatch,
        max_metric_calls=args.budget,
        run_dir=str(out / "gepa"),
        display_progress_bar=True,
    )

    best = result.best_candidate
    best_dir = adapter.materialize(best, out / "best" / skill_dir.name)
    diff = "".join(
        difflib.unified_diff(
            seed_body.splitlines(keepends=True), best[COMPONENT].splitlines(keepends=True), "seed", "best"
        )
    )
    (out / "best.diff").write_text(diff)

    summary = {
        "candidates_tried": len(result.candidates),
        "val_seed": result.val_aggregate_scores[0],
        "val_best": result.val_aggregate_scores[result.best_idx],
    }
    if holdout:
        # Scored once, after the climb, so the optimizer never saw these cases.
        summary["holdout_seed"] = mean_score(adapter, holdout, seed)
        summary["holdout_best"] = mean_score(adapter, holdout, best)
    summary["skill_run_cost_usd"] = round(adapter.total_cost, 2)
    (out / "summary.json").write_text(json.dumps(summary, indent=2))

    print(json.dumps(summary, indent=2))
    print(f"\nBest skill: {best_dir}\nDiff:       {out / 'best.diff'}\nInspect logs: inspect view --log-dir {out / 'inspect-logs'}")


if __name__ == "__main__":
    main()

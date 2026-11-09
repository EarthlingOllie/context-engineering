"""Inspect AI task that evaluates any Claude Code skill against a JSONL case file.

    inspect eval skill_eval/task.py --model none --epochs 3 \
        -T skill=examples/release-note/skill \
        -T cases=examples/release-note/cases.jsonl

Case format (one JSON object per line):

    {"id": "fix-login",                      # unique
     "prompt": "...",                        # passed to the skill as its arguments
     "expected": "...",                      # reference answer (optional for judge)
     "grader": "judge" | "contains",         # default "judge"
     "rubric": "...",                        # what a good answer must do (judge only)
     "repo": "fixtures/repo-a",              # optional; copied in as the working dir
     "split": "train" | "val" | "holdout"}   # used by optimize.py
"""

from __future__ import annotations

import json
import re
import shutil
import tempfile
from pathlib import Path

from inspect_ai import Task, task
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.scorer import Score, Target, mean, scorer, stderr
from inspect_ai.solver import Generate, TaskState, solver

from skill_eval.claude import run_claude

SCORER_NAME = "skill_grader"
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def resolve(path: str | Path) -> Path:
    """`inspect eval` runs tasks from the task file's directory, so relative
    paths are tried against the current directory, then the project root."""
    path = Path(path)
    if path.is_absolute() or path.exists():
        return path.resolve()
    return (PROJECT_ROOT / path).resolve()


def load_cases(path: str | Path) -> list[dict]:
    path = resolve(path)
    cases = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    for case in cases:
        if case.get("repo"):
            case["repo"] = str((path.parent / case["repo"]).resolve())
    return cases


def skill_name(skill_dir: str | Path) -> str:
    text = (Path(skill_dir) / "SKILL.md").read_text()
    match = re.search(r"^name:\s*(\S+)", text, re.MULTILINE)
    return match.group(1) if match else Path(skill_dir).name


@solver
def run_skill(skill: str, allowed_tools: list[str], model: str | None, timeout: int):
    name = skill_name(skill)

    async def solve(state: TaskState, generate: Generate) -> TaskState:
        work = Path(tempfile.mkdtemp(prefix="skill-eval-run-"))
        try:
            repo = state.metadata.get("repo")
            if repo:
                shutil.copytree(repo, work, dirs_exist_ok=True)
            # A fresh copy per run: edits made by one run never leak into the next.
            shutil.copytree(skill, work / ".claude" / "skills" / name, dirs_exist_ok=True)
            result = await run_claude(
                f"/{name} {state.input_text}",
                cwd=str(work),
                allowed_tools=allowed_tools,
                model=model,
                timeout=timeout,
            )
        finally:
            shutil.rmtree(work, ignore_errors=True)
        state.output.completion = (
            result.text if result.ok else f"[run failed: {result.error}]\n{result.text}"
        )
        state.metadata["cost_usd"] = result.cost_usd
        state.metadata["turns"] = result.turns
        return state

    return solve


JUDGE_PROMPT = """You are grading the output of an AI coding skill. Be strict and specific.

<task>
{task}
</task>

<reference_answer>
{expected}
</reference_answer>

<rubric>
{rubric}
</rubric>

<output_to_grade>
{output}
</output_to_grade>

Score from 0.0 (fails the rubric) to 1.0 (fully meets it). In the feedback, say
exactly which rubric points were missed and what the output should have done
instead; this feedback is used to improve the skill.

Reply with only a JSON object: {{"score": <number>, "feedback": "<1-4 sentences>"}}"""


def _parse_judge(text: str) -> tuple[float, str]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return 0.0, f"judge returned no JSON: {text[:300]}"
    try:
        data = json.loads(match.group(0))
        return max(0.0, min(1.0, float(data["score"]))), str(data.get("feedback", ""))
    except (ValueError, KeyError, TypeError) as exc:
        return 0.0, f"judge JSON unreadable ({exc}): {text[:300]}"


@scorer(metrics=[mean(), stderr()], name=SCORER_NAME)
def skill_grader(judge_model: str | None = None):
    async def score(state: TaskState, target: Target) -> Score:
        output = state.output.completion
        if state.metadata.get("grader") == "contains":
            hit = target.text.lower() in output.lower()
            return Score(
                value=1.0 if hit else 0.0,
                answer=output[-500:],
                explanation="Output contains the expected answer."
                if hit
                else f"Expected the output to mention '{target.text}', but it did not.",
            )
        result = await run_claude(
            JUDGE_PROMPT.format(
                task=state.input_text,
                expected=target.text or "(none given)",
                rubric=state.metadata.get("rubric") or "(none given)",
                output=output,
            ),
            model=judge_model,
            timeout=300,
        )
        value, feedback = _parse_judge(result.text) if result.ok else (0.0, result.error)
        return Score(value=value, answer=output[-500:], explanation=feedback)

    return score


@task
def skill_eval(
    skill: str,
    cases: str,
    split: str | None = None,
    allowed_tools: str = "Read,Grep,Glob",
    model: str | None = None,
    judge_model: str | None = None,
    timeout: int = 900,
) -> Task:
    selected = [c for c in load_cases(cases) if split is None or c.get("split") == split]
    samples = [
        Sample(
            id=c["id"],
            input=c["prompt"],
            target=c.get("expected", ""),
            metadata={
                "grader": c.get("grader", "judge"),
                "rubric": c.get("rubric", ""),
                "repo": c.get("repo"),
            },
        )
        for c in selected
    ]
    tools = [t for t in allowed_tools.split(",") if t]
    return Task(
        dataset=MemoryDataset(samples),
        solver=run_skill(str(resolve(skill)), tools, model, timeout),
        scorer=skill_grader(judge_model),
    )

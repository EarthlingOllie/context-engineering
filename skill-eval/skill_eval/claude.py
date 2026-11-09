"""Run Claude Code headlessly (`claude -p`) and return its final answer.

Every model call in this harness goes through the `claude` CLI, so the only
credential needed is the one Claude Code already uses.
"""

from __future__ import annotations

import json
import subprocess as std_subprocess
import tempfile
from dataclasses import dataclass

from inspect_ai.util import subprocess


@dataclass
class ClaudeResult:
    text: str
    ok: bool
    cost_usd: float = 0.0
    turns: int = 0
    error: str = ""


def _base_args(allowed_tools: list[str] | None, model: str | None) -> list[str]:
    args = ["claude", "-p", "--output-format", "json"]
    if allowed_tools:
        # Tools not listed here are denied: headless mode cannot ask for permission.
        args += ["--allowedTools", ",".join(allowed_tools)]
    if model:
        args += ["--model", model]
    return args


def _parse(stdout: str, stderr: str) -> ClaudeResult:
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        return ClaudeResult(text=stdout, ok=False, error=(stderr or stdout)[-2000:])
    return ClaudeResult(
        text=data.get("result", "") or "",
        ok=not data.get("is_error", False),
        cost_usd=float(data.get("total_cost_usd") or 0.0),
        turns=int(data.get("num_turns") or 0),
        error="" if not data.get("is_error") else str(data.get("subtype", "error")),
    )


async def run_claude(
    prompt: str,
    cwd: str | None = None,
    allowed_tools: list[str] | None = None,
    model: str | None = None,
    timeout: int = 900,
) -> ClaudeResult:
    """Async call, for use inside Inspect solvers and scorers."""
    try:
        result = await subprocess(
            _base_args(allowed_tools, model),
            input=prompt,
            cwd=cwd or tempfile.gettempdir(),
            timeout=timeout,
        )
    except TimeoutError:
        return ClaudeResult(text="", ok=False, error=f"timed out after {timeout}s")
    return _parse(result.stdout, result.stderr)


def run_claude_sync(prompt: str, model: str | None = None, timeout: int = 900) -> str:
    """Blocking call with no tools, used as GEPA's reflection model."""
    with tempfile.TemporaryDirectory(prefix="skill-eval-reflect-") as empty:
        proc = std_subprocess.run(
            _base_args(None, model),
            input=prompt,
            cwd=empty,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    result = _parse(proc.stdout, proc.stderr)
    if not result.ok:
        raise RuntimeError(f"reflection call failed: {result.error}")
    return result.text

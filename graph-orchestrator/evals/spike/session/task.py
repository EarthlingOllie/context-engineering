"""Session-sandbox spike (observability-evals ticket 01, ships nothing).

Headless Claude Code, pinned in the image, with the graph-orchestrator plugin
installed from this repository's working tree, inside an Inspect Docker
sandbox, run through the inspect_swe Claude Code agent. Every model call goes
through Inspect's sandbox agent bridge. The raw stream-json transcript is kept
(inspect_swe debug output) and read by probe.py, which answers: did the
orchestrator skill load, did a Workflow launch return a result, what did the
session cost and how long did it take.

Modes:
  mock  free. mockllm stands in for the model and scripts three steps: load the
        orchestrator skill, launch a tiny Workflow script, then answer. It shows
        the plumbing (plugin install, skill load, Workflow launch and its
        completion notice in -p mode) without a model.
  live  PAID. The real model runs one small orchestrated session over the
        fixture repository (see README.md).

    inspect eval graph-orchestrator/evals/spike/session/task.py@session_spike -T mode=mock
    inspect eval graph-orchestrator/evals/spike/session/task.py@session_spike -T mode=live \
        --model anthropic/claude-opus-5-5 -T cost_limit=10
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from inspect_ai import Task, task
from inspect_ai.agent import Agent, AgentState, agent
from inspect_ai.dataset import Sample
from inspect_ai.model import ModelCost, ModelOutput, get_model, set_model_cost
from inspect_ai.scorer import Score, Target, accuracy, scorer
from inspect_ai.solver import TaskState
from inspect_ai.util import sandbox, store

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import probe  # noqa: E402

REPO = HERE.parents[3]  # context-engineering/
FIXTURE = HERE / "fixture"
SANDBOX_REPO = "/opt/repo"
WORK = "/work/repo"
USER = "node"
CLAUDE_CODE_VERSION = "2.1.332"  # must match sandbox/Dockerfile
MAIN_MODEL = "claude-opus-5-5"

# $/MTok, as in the dispatch-evals spike (claude-api skill table, cached 2026-11-03).
PRICES = {
    "claude-opus-5-5": ModelCost(input=4.0, output=20.0, input_cache_write=5.0, input_cache_read=0.20),
    "claude-sonnet-5-5": ModelCost(input=2.0, output=10.0, input_cache_write=2.5, input_cache_read=0.10),
    "claude-haiku-5-5": ModelCost(input=0.10, output=0.50, input_cache_write=0.125, input_cache_read=0.01),
}

MOCK_WORKFLOW_SCRIPT = (
    "export const meta = { name: 'Spike: session sandbox probe', description: 'B-01 mock launch' }\n"
    "log('session spike probe ran')\n"
    "return { status: 'done', probe: 'session-sandbox' }"
)

LIVE_PROMPT = (FIXTURE / "task.md").read_text() if (FIXTURE / "task.md").exists() else ""
MOCK_PROMPT = "Load the graph-orchestrator skill, then launch one Workflow and report its result."


def working_tree_files(repo: Path = REPO) -> list[Path]:
    """Tracked plus untracked, non-ignored files of the working tree (the commit under test, uncommitted edits included)."""
    out = subprocess.run(
        ["git", "-C", str(repo), "ls-files", "-co", "--exclude-standard", "-z"],
        check=True, capture_output=True,
    ).stdout.decode()
    return [repo / p for p in out.split("\0") if p and (repo / p).is_file()]


def mock_outputs() -> Any:
    """mockllm script: Skill(graph-orchestrator), then Workflow(tiny script), then plain text.

    Decided from the conversation so far, so Claude Code's side calls (no tools) get text."""

    def called(messages: list, name: str) -> bool:
        return any(
            getattr(m, "role", "") == "assistant" and any(tc.function == name for tc in (m.tool_calls or []))
            for m in messages
        )

    def generate(input: list, tools: list, tool_choice: Any, config: Any) -> ModelOutput:
        names = {t.name for t in tools}
        if "Skill" in names and not called(input, "Skill"):
            return ModelOutput.for_tool_call("mockllm/model", "Skill", {"skill": "graph-orchestrator:graph-orchestrator"})
        if "Workflow" in names and not called(input, "Workflow"):
            return ModelOutput.for_tool_call("mockllm/model", "Workflow", {"script": MOCK_WORKFLOW_SCRIPT})
        return ModelOutput.from_content("mockllm/model", "Mock turn: nothing more to do.")

    return generate


def _mock_model() -> Any:
    model = get_model("mockllm/model", custom_outputs=mock_outputs())

    # mockllm counts tokens with tiktoken, which downloads its encoding on first
    # use; a host without that network would fail every bridged call.
    async def count_text_tokens(text: str) -> int:
        return len(text) // 4 + 1

    model.api.count_text_tokens = count_text_tokens  # type: ignore[method-assign]
    return model


@agent
def orchestrated_session(mode: str = "mock", timeout: int = 1800) -> Agent:
    from inspect_swe import claude_code
    from inspect_swe._claude_code.claude_code import ClaudeCodeDebug
    from inspect_ai.util import store_as

    async def execute(state: AgentState) -> AgentState:
        sbx = sandbox()
        for f in working_tree_files():
            await sbx.write_file(f"{SANDBOX_REPO}/{f.relative_to(REPO)}", f.read_bytes())
        for f in (p for p in (FIXTURE / "repo").rglob("*") if p.is_file()):
            await sbx.write_file(f"{WORK}/{f.relative_to(FIXTURE / 'repo')}", f.read_bytes())
        # Project scope: inspect_swe rewrites ~/.claude/settings.json (its apiKeyHelper)
        # before launching Claude Code, which drops a user-scope plugin install.
        setup = (
            f"git -C {WORK} init -q 2>/dev/null || true; "
            f"claude plugin marketplace add --scope project {SANDBOX_REPO} && "
            "claude plugin install --scope project graph-orchestrator@earthlingollie"
        )
        res = await sbx.exec(["bash", "-lc", f"chown -R {USER} {SANDBOX_REPO} /work 2>/dev/null; true"], user="root")
        res = await sbx.exec(["bash", "-lc", setup], user=USER, cwd=WORK, timeout=300)
        store().set("plugin_install", (res.stdout + res.stderr)[-4000:])

        cc = claude_code(
            version="sandbox",
            user=USER,
            cwd=WORK,
            permission_mode="bypassPermissions",
            debug=True,
            model=None if mode == "mock" else f"anthropic/{MAIN_MODEL}",
            model_config=MAIN_MODEL,  # the name Claude Code sees; mockllm's "model" is refused
        )
        try:
            state = await cc(state)
        finally:
            dbg = store_as(ClaudeCodeDebug)
            store().set("transcript", "\n".join(l.rstrip("\n") for l in dbg.stdout))
            store().set("stderr", "".join(dbg.stderr)[-8000:])
            ls = await sbx.exec(["bash", "-lc", f"cd {WORK} && find . -path ./.git -prune -o -type f -print | head -200"])
            store().set("work_files", ls.stdout)
        return state

    return execute


@scorer(metrics=[accuracy()])
def session_spike_scorer(live: bool = False):
    """1 when probe.analyse finds the skill loaded and a Workflow launch that returned a result."""

    async def score(state: TaskState, target: Target) -> Score:
        lines = (store().get("transcript", "") or "").splitlines()
        findings = probe.analyse(lines)
        rec = probe.recommend(findings, live=live)
        ok = findings["skill_loaded"] and findings["workflow_returned"]
        return Score(
            value=1 if ok else 0,
            answer=rec["decision"],
            explanation=json.dumps({**findings, "recommendation": rec}, default=str),
            metadata={"plugin_install": store().get("plugin_install"), "work_files": store().get("work_files")},
        )

    return score


@task
def session_spike(mode: str = "mock", cost_limit: float = 10.0, time_limit: int = 1800) -> Task:
    if mode not in ("mock", "live"):
        raise ValueError("mode is mock or live")
    for name, cost in PRICES.items():
        set_model_cost(f"anthropic/{name}", cost)
    prompt = MOCK_PROMPT if mode == "mock" else LIVE_PROMPT
    return Task(
        dataset=[Sample(id=f"session-spike-{mode}", input=prompt, target="workflow returned")],
        solver=orchestrated_session(mode=mode, timeout=time_limit),
        scorer=session_spike_scorer(live=mode == "live"),
        sandbox=("docker", str(HERE / "compose.yaml")),
        model=_mock_model() if mode == "mock" else None,
        cost_limit=None if mode == "mock" else cost_limit,
        time_limit=time_limit,
        metadata={"claude_code_version": CLAUDE_CODE_VERSION},
    )

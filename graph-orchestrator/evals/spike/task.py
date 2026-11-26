"""Ticket-01 spike (throwaway): sample 1, a `single` dispatch over the docs fixture.

Inspect starts the Docker sandbox from compose.yaml, the solver copies the
shipped bundle, this repo's skills plugin and the fixture into it, opens the
sandbox agent bridge and runs the Node harness, whose Agent SDK talks to the
bridge on localhost. Every model call is therefore an Inspect model call.

Run (paid; see README.md):
    inspect eval graph-orchestrator/evals/spike/task.py@spike \
        --model anthropic/claude-opus-5-5 --log-dir graph-orchestrator/evals/spike/logs

Dry run (no model call; the harness uses canned answers):
    inspect eval graph-orchestrator/evals/spike/task.py@spike -T stub=true --model mockllm/model
"""

from __future__ import annotations

import json
from pathlib import Path

from inspect_ai import Task, task
from inspect_ai.agent import Agent, AgentState, agent, sandbox_agent_bridge
from inspect_ai.dataset import Sample
from inspect_ai.model import ModelCost, set_model_cost
from inspect_ai.scorer import Score, Target, accuracy, scorer
from inspect_ai.solver import TaskState
from inspect_ai.util import sandbox, store

HERE = Path(__file__).resolve().parent
PLUGIN = HERE.parent.parent  # graph-orchestrator/
REPO = PLUGIN.parent
SKILLS = REPO / "skills"
FIXTURE = HERE / "fixture"

MAIN_MODEL = "claude-opus-5-5"
# Every id a role may request is declared to the bridge (spec: Model routing).
DECLARED = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
# Condition 3: one declared alias that differs from the main model, and one
# undeclared name that should fall back to the main model.
PROBES = ["claude-haiku-5-5", "claude-undeclared-spike"]

# $/MTok, Anthropic first-party (claude-api skill price table, cached 2026-11-03).
# Cache write = 1.25x input (5-minute TTL) and Haiku cache read = 0.1x input are
# assumptions to confirm on the live pricing page before the run.
PRICES = {
    "claude-opus-5-5": ModelCost(input=4.0, output=20.0, input_cache_write=5.0, input_cache_read=0.20),
    "claude-sonnet-5-5": ModelCost(input=2.0, output=10.0, input_cache_write=2.5, input_cache_read=0.10),
    "claude-haiku-5-5": ModelCost(input=0.10, output=0.50, input_cache_write=0.125, input_cache_read=0.01),
}


def _register_prices() -> None:
    for name, cost in PRICES.items():
        set_model_cost(f"anthropic/{name}", cost)


def _walk(root: Path, skip: tuple[str, ...] = ("node_modules", ".git")) -> list[Path]:
    return [p for p in root.rglob("*") if p.is_file() and not any(s in p.parts for s in skip)]


@agent
def dispatch_harness(stub: bool = False, cap: int = 2, timeout: int = 1800) -> Agent:
    async def execute(state: AgentState) -> AgentState:
        sbx = sandbox()
        # Bundle, skills plugin and fixture into the sandbox.
        await sbx.write_file("/opt/plugin/workflows/dispatch.js", (PLUGIN / "workflows" / "dispatch.js").read_text())
        for f in _walk(SKILLS):
            await sbx.write_file(f"/opt/skills/{f.relative_to(SKILLS)}", f.read_bytes())
        for f in _walk(FIXTURE / "docs"):
            await sbx.write_file(f"/work/docs/{f.relative_to(FIXTURE / 'docs')}", f.read_bytes())
        await sbx.write_file("/work/args.json", (FIXTURE / "args.json").read_text())

        aliases = {name: f"anthropic/{name}" for name in DECLARED}
        cmd = [
            "node", "/opt/harness/harness.mjs",
            "--bundle", "/opt/plugin/workflows/dispatch.js",
            "--args", "/work/args.json",
            "--out", "/work/result.json",
            "--cap", str(cap),
            "--model", MAIN_MODEL,
            "--skills", "/opt/skills",
            "--cwd", "/work",
            "--probe-models", ",".join(PROBES),
        ] + (["--stub"] if stub else [])

        async with sandbox_agent_bridge(state, model_aliases=None if stub else aliases) as bridge:
            env = {
                "ANTHROPIC_BASE_URL": f"http://localhost:{bridge.port}",
                # The SDK needs a key to start; the bridge ignores it. The real
                # API key and workspace key stay on the host with Inspect.
                "ANTHROPIC_API_KEY": "sk-ant-bridge-placeholder",
            }
            res = await sbx.exec(cmd, env=env, cwd="/work", timeout=timeout)
            store().set("harness_stdout", res.stdout[-4000:])
            store().set("harness_stderr", res.stderr[-8000:])
            try:
                store().set("harness_result", json.loads(await sbx.read_file("/work/result.json")))
            except Exception as e:  # noqa: BLE001
                store().set("harness_result", {"error": f"no result file: {e}"})
            try:
                trace = await sbx.read_file("/work/scratch/trace/w1-d1.jsonl")
            except Exception:  # noqa: BLE001
                trace = ""
            store().set("trace", trace)
            return bridge.state

    return execute


@scorer(metrics=[accuracy()])
def spike_scorer():
    """Records the evidence the spike note needs; value is 1 when the dispatch returned done with its trace written."""

    async def score(state: TaskState, target: Target) -> Score:
        result = store().get("harness_result", {}) or {}
        ret = result.get("return") or {}
        trace = store().get("trace", "") or ""
        agents = result.get("agents", [])
        skills = sorted({s for a in agents for s in a.get("skillsInvoked", [])})
        ok = ret.get("status") == "done" and '"type":"dispatch"' in trace
        return Score(
            value=1 if ok else 0,
            answer=ret.get("status", "error"),
            explanation=json.dumps({
                "status": ret.get("status"),
                "trace_lines": len([l for l in trace.splitlines() if l.strip()]),
                "wall_clock_ms": result.get("wallClockMs"),
                "agents": len(agents),
                "skills_invoked": skills,
                "probes": result.get("probes"),
                "harness_error": result.get("error"),
            }),
            metadata={"harness_result": result, "trace": trace},
        )

    return score


@task
def spike(stub: bool = False, cap: int = 2, cost_limit: float = 5.0, time_limit: int = 1800) -> Task:
    _register_prices()
    return Task(
        dataset=[Sample(id="sample-1-single-docs", input="Run dispatch w1-d1 (single over the docs fixture).", target="done")],
        solver=dispatch_harness(stub=stub, cap=cap, timeout=time_limit),
        scorer=spike_scorer(),
        sandbox=("docker", str(HERE / "compose.yaml")),
        cost_limit=None if stub else cost_limit,
        time_limit=time_limit,
    )

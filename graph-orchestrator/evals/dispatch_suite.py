"""The dispatch suite as an Inspect task: each sample is one dispatch eval.

The solver copies the shipped bundle (workflows/dispatch.js, read as is), this
repo's skills plugin, the harness source and the fixture's sandbox tree into a
Docker sandbox; records the sandbox file tree; opens the sandbox agent bridge
with every model a role may request declared; and runs the Node harness
(every role on the pinned model unless `role_models` forces one elsewhere), whose
Agent SDK talks to the bridge, so every model call is an Inspect model call.
It then records the harness result file, the trace and the files the agents
wrote. The hidden check never enters the sandbox while the agents run: the
scorers read it on the host, and a fixture's hidden tests are copied in and
run only after the dispatch has finished and its files have been recorded.

Run it through run.py, which also writes the scorecard. Directly:
    inspect eval graph-orchestrator/evals/dispatch_suite.py@dispatch_suite --model anthropic/claude-opus-5-5
"""

from __future__ import annotations

import json
from pathlib import Path

from inspect_ai import Task, task
from inspect_ai.agent import Agent, AgentState, agent, as_solver, sandbox_agent_bridge
from inspect_ai.dataset import Sample
from inspect_ai.model import ModelCost, ModelInfo, set_model_cost, set_model_info
from inspect_ai.scorer import Score, Target, accuracy, scorer
from inspect_ai.solver import Generate, TaskState, solver
from inspect_ai.util import sandbox, store

import suite
from scoring import Recorded, chosen_candidate, outcome, status_truthful

HARNESS = suite.EVALS / "harness"
SCRATCH = "/work/scratch"


STUB_MODEL = "mockllm/model"


def register_prices() -> None:
    for name, p in suite.PRICES.items():
        set_model_cost(f"anthropic/{name}", ModelCost(**p))
    # The dry run's model costs nothing, but is priced so its cost limit applies like a paid run's.
    set_model_info(STUB_MODEL, ModelInfo(cost=ModelCost(input=0.0, output=0.0, input_cache_write=0.0, input_cache_read=0.0)))


def compose_file(cpus: int, memory: str) -> Path:
    """The sandbox's compose file for these run parameters (generated: CPU count and memory are run parameters)."""
    out = suite.EVALS / "out"
    out.mkdir(exist_ok=True)
    path = out / f"compose-{cpus}cpu-{memory}.yaml"
    path.write_text(suite.compose_yaml(cpus, memory))
    return path


def _walk(root: Path) -> list[Path]:
    return [p for p in sorted(root.rglob("*")) if p.is_file() and not ({"node_modules", ".git", "__pycache__"} & set(p.parts))]


async def _lines(cmd: str) -> list[str]:
    res = await sandbox().exec(["sh", "-c", cmd])
    return [l for l in res.stdout.splitlines() if l.strip()]


@agent
def dispatch_harness(
    stub: bool = False, cap: int = suite.DEFAULT_CAP, timeout: int = suite.DEFAULT_TIME_LIMIT, stub_delay_ms: int = 0, stub_evaluator: str = "pass",
    role_models: str = "", stub_serve_model: str = "",
) -> Agent:
    async def execute(state: AgentState) -> AgentState:
        sbx = sandbox()
        meta = store().get("sample_meta")
        # The plugin as shipped, read as text; skills and harness at the commit under test.
        await sbx.write_file("/opt/plugin/workflows/dispatch.js", (suite.PLUGIN / "workflows" / "dispatch.js").read_text())
        for f in _walk(suite.SKILLS):
            await sbx.write_file(f"/opt/skills/{f.relative_to(suite.SKILLS).as_posix()}", f.read_bytes())
        for f in HARNESS.glob("*.ts"):
            if not f.name.endswith(".test.ts"):
                await sbx.write_file(f"/opt/harness/src/{f.name}", f.read_text())
        for dest, src in suite.fixture_sandbox_files(meta["fixture"]).items():
            await sbx.write_file(dest, src.read_bytes())
        await sbx.write_file("/work/args.json", json.dumps(meta["args"]))

        # The sandbox as the agents will find it: the hidden check must not be in it.
        store().set("sandbox_tree", await _lines("find /work /opt -type f -not -path '*/node_modules/*' | sort"))

        cmd = suite.harness_command(
            cap=meta.get("cap", cap),  # a concurrency-sweep sample carries its own cap
            role_models=suite.parse_role_models(role_models), stub=stub,
            stub_delay_ms=stub_delay_ms, stub_evaluator=stub_evaluator, stub_serve_model=stub_serve_model,
            watch=suite.hidden_check(meta).get("watch"),
        )
        aliases = {name: f"anthropic/{name}" for name in suite.DECLARED_MODELS}
        async with sandbox_agent_bridge(state, model_aliases=None if stub else aliases) as bridge:
            env = {
                "ANTHROPIC_BASE_URL": f"http://localhost:{bridge.port}",
                # The SDK needs a key to start; the bridge ignores it. Real keys stay on the host with Inspect.
                "ANTHROPIC_API_KEY": "sk-ant-bridge-placeholder",
            }
            # Inspect's time_limit stops the sample (recorded as a limit, not an error);
            # this exec timeout is only a backstop past it.
            res = await sbx.exec(cmd, env=env, cwd="/work", timeout=timeout + 60)
            store().set("harness_stdout", res.stdout[-4000:])
            store().set("harness_stderr", res.stderr[-8000:])
            try:
                store().set("harness_result", json.loads(await sbx.read_file("/work/result.json")))
            except Exception as e:  # noqa: BLE001
                store().set("harness_result", {"error": f"no result file: {e}"})
            dispatch_id = meta["args"]["dispatch"]["id"]
            try:
                store().set("trace", await sbx.read_file(f"{SCRATCH}/trace/{dispatch_id}.jsonl"))
            except Exception:  # noqa: BLE001
                store().set("trace", "")
            files = {}
            for p in await _lines(f"find {SCRATCH} -type f -not -path '{SCRATCH}/trace/*' 2>/dev/null | sort | head -200"):
                try:
                    files[p] = await sbx.read_file(p)
                except Exception:  # noqa: BLE001
                    pass
            store().set("files", files)
            # The fixture's own files as the agents left them, for checks that a file was not changed.
            after = {}
            for p in suite.fixture_sandbox_files(meta["fixture"]):
                try:
                    after[p] = await sbx.read_file(p)
                except Exception:  # noqa: BLE001  (deleted)
                    pass
            store().set("after", after)
            await run_hidden_tests(meta)
            return bridge.state

    return execute


# Where a `chosen_tests` check lays the chosen candidate over the fixture and runs the hidden tests (not /work).
CHOSEN_ROOT = "/tmp/chosen"


async def run_hidden_tests(meta: dict) -> None:
    """Scoring step, after the dispatch: copy the fixture's hidden tests into the sandbox and run them there.

    For a `chosen_tests` check (best-of-n), they run in CHOSEN_ROOT on the fixture as shipped with the files of
    the candidate the judge chose laid over it (suite.chosen_candidate_tree); the run records that candidate."""
    check = suite.hidden_check(meta)
    if check["kind"] not in suite.TESTED_KINDS:
        return
    sbx = sandbox()
    root, extra = "/work", {}
    if check["kind"] == "chosen_tests":
        chosen = chosen_candidate(Recorded(result=store().get("harness_result", {}) or {}))
        extra = {"candidate": chosen}
        if chosen is None:
            store().set("hidden_tests", {"exit_code": None, "output": "no chosen candidate to test", **extra})
            return
        root = CHOSEN_ROOT
        candidate_dir = f"{SCRATCH}/{meta['args']['dispatch']['id']}-c{chosen}"
        for rel, src in suite.chosen_candidate_tree(meta["fixture"], store().get("files", {}) or {}, candidate_dir).items():
            await sbx.write_file(f"{root}/{rel}", src.read_bytes() if isinstance(src, Path) else src)
    for f in suite.hidden_test_files(meta["fixture"]):
        await sbx.write_file(f"{root}/{suite.HIDDEN_TESTS_DIR.removeprefix('/work/')}/{f.name}", f.read_text())
    try:
        res = await sbx.exec(suite.hidden_tests_cmd(check), cwd=root, timeout=300)
        store().set("hidden_tests", {"exit_code": res.returncode, "output": (res.stdout + res.stderr)[-4000:], **extra})
    except Exception as e:  # noqa: BLE001  (timeout or sandbox error: scored as not run)
        store().set("hidden_tests", {"exit_code": None, "output": f"hidden tests could not run: {e}", **extra})


def recorded_from_store(usage: dict | None = None) -> Recorded:
    return Recorded(
        result=store().get("harness_result", {}) or {},
        trace=store().get("trace", "") or "",
        files=store().get("files", {}) or {},
        sandbox_tree=store().get("sandbox_tree", []) or [],
        usage=usage or {},
        after=store().get("after", {}) or {},
        hidden_tests=store().get("hidden_tests"),
    )


@scorer(metrics=[accuracy()])
def outcome_correct_scorer():
    """The sample's hidden check (suite.hidden_check): planted facts, blocked with a question, over_budget, hidden tests, exhausted, a chain's stop,
    a panel's verdict, an iterative fan-out's coverage, a best-of-n's chosen candidate, a verdict in the return contract or a relay's hand-over."""

    async def score(state: TaskState, target: Target) -> Score:
        ok, missing = outcome(recorded_from_store(), suite.hidden_check(state.metadata))
        return Score(value=1 if ok else 0, explanation="failed: " + "; ".join(missing) if missing else "hidden check passed")

    return score


@scorer(metrics=[accuracy()])
def status_truthful_scorer():
    async def score(state: TaskState, target: Target) -> Score:
        rec = recorded_from_store()
        reported = (rec.result.get("return") or {}).get("status")
        ok = status_truthful(rec, state.metadata["expected_status"])
        return Score(value=1 if ok else 0, answer=str(reported), explanation=f"reported {reported}, expected {state.metadata['expected_status']}")

    return score


@solver
def sample_meta():
    """Puts the sample's metadata in the store, where the bridged agent can read it."""

    async def solve(state: TaskState, generate: Generate) -> TaskState:
        store().set("sample_meta", dict(state.metadata))
        return state

    return solve


@task
def dispatch_suite(
    stub: bool = False,
    cap: int = suite.DEFAULT_CAP,
    cpus: int = suite.DEFAULT_CPUS,
    memory: str = suite.DEFAULT_MEMORY,
    epochs: int = suite.DEFAULT_EPOCHS,
    samples: str = "",
    cost_limit: float = suite.DEFAULT_COST_LIMIT,
    time_limit: int = suite.DEFAULT_TIME_LIMIT,
    stub_delay_ms: int = 0,
    stub_evaluator: str = "pass",
    role_models: str = "",
    stub_serve_model: str = "",
) -> Task:
    """`role_models` ("evaluator=claude-haiku-5-5,...") forces roles onto other declared models through the harness,
    to show the routing check; empty in the baseline. `stub_serve_model` makes the stub report every call as served
    on that model (a dry run of the bridge's fallback)."""
    register_prices()
    suite.parse_role_models(role_models)  # refuse an unknown role or undeclared model before any sandbox starts
    wanted = {s for s in samples.split(",") if s}
    dataset = [
        Sample(
            id=s["id"],
            input=f"Run dispatch {s['args']['dispatch']['id']}: {s['description']}",
            target=s["expected_status"],
            metadata={"fixture": s["fixture"], "expected_status": s["expected_status"], "check": s.get("check", {}), "args": s["args"]},
        )
        for s in suite.load_samples()
        if not wanted or s["id"] in wanted
    ]
    return Task(
        dataset=dataset,
        solver=[
            sample_meta(),
            as_solver(
                dispatch_harness(
                    stub=stub, cap=cap, timeout=time_limit, stub_delay_ms=stub_delay_ms, stub_evaluator=stub_evaluator,
                    role_models=role_models, stub_serve_model=stub_serve_model,
                )
            ),
        ],
        scorer=[outcome_correct_scorer(), status_truthful_scorer()],
        sandbox=("docker", str(compose_file(cpus, memory))),
        epochs=epochs,
        # Every sample stops at whichever comes first: its dollar limit or its wall-clock limit.
        cost_limit=cost_limit,
        time_limit=time_limit,
        metadata={"cap": cap, "cpus": cpus, "memory": memory, "stub": stub, "cost_limit": cost_limit, "time_limit": time_limit, "role_models": role_models},
    )


@task
def concurrency_sweep(
    caps: str = ",".join(map(str, suite.DEFAULT_SWEEP_CAPS)),
    cpus: int = suite.DEFAULT_CPUS,
    memory: str = suite.DEFAULT_MEMORY,
    epochs: int = suite.DEFAULT_SWEEP_EPOCHS,
    stub: bool = False,
    cost_limit: float = suite.DEFAULT_COST_LIMIT,
    time_limit: int = suite.DEFAULT_TIME_LIMIT,
    stub_delay_ms: int = 0,
) -> Task:
    """On demand, outside the routine run and its budget: the fan-out samples (suite.SWEEP_SAMPLES) once per cap
    (suite.sweep_samples), each run by the harness under its own cap, on one sandbox spec (`cpus`, `memory`).
    Run it through sweep.py, which also writes the table. Each run has the same per-sample limits as the suite."""
    register_prices()
    cap_list = [int(c) for c in caps.split(",") if c.strip()]
    dataset = [
        Sample(
            id=s["id"],
            input=f"Run dispatch {s['args']['dispatch']['id']} at cap {s['cap']}: {s['description']}",
            target=s["expected_status"],
            metadata={
                "fixture": s["fixture"], "expected_status": s["expected_status"], "check": s.get("check", {}), "args": s["args"],
                "sample": s["sample"], "cap": s["cap"],
            },
        )
        for s in suite.sweep_samples(cap_list)
    ]
    return Task(
        dataset=dataset,
        solver=[sample_meta(), as_solver(dispatch_harness(stub=stub, timeout=time_limit, stub_delay_ms=stub_delay_ms))],
        scorer=[outcome_correct_scorer(), status_truthful_scorer()],
        sandbox=("docker", str(compose_file(cpus, memory))),
        epochs=epochs,
        cost_limit=cost_limit,
        time_limit=time_limit,
        metadata={"caps": cap_list, "cpus": cpus, "memory": memory, "stub": stub, "cost_limit": cost_limit, "time_limit": time_limit},
    )

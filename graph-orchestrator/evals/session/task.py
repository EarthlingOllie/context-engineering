"""Session evals (observability-evals ticket 08): the session seam.

One sample is a scenario (scenarios/<name>/scenario.json): a task, a fixture
repository, an orchestrator mode, and the hooks and permissions to install.
The harness copies the plugin (the working tree, or a git ref with -T
plugin_ref=...) to /opt/repo and installs it at project scope, sets the fixture
up as /work/repo with a local bare remote, installs the hooks, runs headless
Claude Code (inspect_swe, the version pinned in sandbox/Dockerfile) to
completion or the per-sample cost limit, then collects the records: the
stream-json transcript, the scratch directory (trace files, state file, args,
diagram) and the repository's git state. The scenario's scorer (code, in
scorers.py) reads only those records.

Never part of a routine dispatch-eval run: run it with session/run.py (README).

Modes:
  mock  free. mockllm stands in for the model and scripts the main loop
        (hook scenario: -T mock=complies answers the hook naming the running
        dispatch, -T mock=pushes obeys it and pushes; blocked scenario:
        complies labels the blocked work UNVERIFIED and lists it first,
        silent accepts it unlabelled). Checks the plumbing and makes saved
        records; it measures nothing about the plugin.
  live  PAID. The real model runs the scenario's task.
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
import records  # noqa: E402
import scorers  # noqa: E402
from budget import DEFAULT_COST_LIMIT  # noqa: E402

REPO = HERE.parents[2]  # context-engineering/
SCENARIOS = HERE / "scenarios"
SANDBOX_REPO = "/opt/repo"
WORK = "/work/repo"
REMOTE = "/work/remote.git"
USER = "node"
CLAUDE_CODE_VERSION = "2.1.332"  # must match sandbox/Dockerfile
MAIN_MODEL = "claude-opus-5-5"
FIXTURE_TAG = "session-eval-fixture"

# $/MTok, as in the dispatch evals (claude-api skill table, cached 2026-11-03).
PRICES = {
    "claude-opus-5-5": ModelCost(input=4.0, output=20.0, input_cache_write=5.0, input_cache_read=0.20),
    "claude-sonnet-5-5": ModelCost(input=2.0, output=10.0, input_cache_write=2.5, input_cache_read=0.10),
    "claude-haiku-5-5": ModelCost(input=0.10, output=0.50, input_cache_write=0.125, input_cache_read=0.01),
}


def load_scenarios(names: list[str] | None = None) -> list[dict]:
    out = []
    for p in sorted(SCENARIOS.glob("*/scenario.json")):
        s = json.loads(p.read_text())
        s["dir"] = str(p.parent)
        if names is None or s["id"] in names or p.parent.name in names:
            out.append(s)
    if names and len(out) != len(set(names)):
        raise ValueError(f"unknown scenario in {names}; have {[json.loads(p.read_text())['id'] for p in SCENARIOS.glob('*/scenario.json')]}")
    return out


def plugin_files(ref: str | None, repo: Path = REPO) -> dict[str, bytes]:
    """The plugin source to install: the working tree (tracked plus untracked, non-ignored files), or a git ref."""

    def git(*a: str) -> bytes:
        return subprocess.run(["git", "-C", str(repo), *a], check=True, capture_output=True).stdout

    if ref is None:
        paths = [p for p in git("ls-files", "-co", "--exclude-standard", "-z").decode().split("\0") if p]
        return {p: (repo / p).read_bytes() for p in paths if (repo / p).is_file()}
    paths = [p for p in git("ls-tree", "-r", "--name-only", "-z", ref).decode().split("\0") if p]
    return {p: git("show", f"{ref}:{p}") for p in paths}


# --- mock main loop -------------------------------------------------------------------------------------------

MOCK_DISPATCH = {"id": "w1-d1", "topology": "single", "title": "Add the calc test suite"}
# A slow dispatch: the script waits, so the stop hook fires while it runs.
MOCK_WORKFLOW_SCRIPT = (
    "export const meta = { name: 'Single: Add the calc test suite', description: 'w1-d1 · single' }\n"
    "await new Promise((r) => setTimeout(r, 45000))\n"
    "log('STATUS done')\n"
    "return { id: 'w1-d1', title: 'Add the calc test suite', status: 'done', result: 'mock', artifacts: [], iterations: 1 }"
)
MOCK_PROMPT = "Mock session: load the graph-orchestrator skill, launch one dispatch through the Workflow tool, wait for it."


def _text(m: Any) -> str:
    c = getattr(m, "content", "")
    if isinstance(c, str):
        return c
    return "\n".join(getattr(p, "text", "") or "" for p in c or [])


def mock_outputs(behaviour: str, hook_text: str, scratch: str) -> Any:
    """mockllm script for the main loop, decided from the conversation so far:
    Skill, args file, Workflow (slow), a waiting line; after the hook, either a
    one-line answer naming the dispatch plus a `hook` trace event (complies) or
    a commit and push (pushes); a closing line once the dispatch is notified."""

    def calls(messages: list, name: str) -> int:
        return sum(
            1 for m in messages if getattr(m, "role", "") == "assistant"
            for tc in (getattr(m, "tool_calls", None) or []) if tc.function == name
        )

    def generate(input: list, tools: list, tool_choice: Any, config: Any) -> ModelOutput:
        names = {t.name for t in tools}
        if not names:  # Claude Code's side calls (titles, summaries)
            return ModelOutput.from_content("mockllm/model", "mock")
        hook_at = next((i for i, m in enumerate(input) if getattr(m, "role", "") == "user" and hook_text in _text(m)), None)
        if not calls(input, "Skill"):
            return ModelOutput.for_tool_call("mockllm/model", "Skill", {"skill": "graph-orchestrator:graph-orchestrator"})
        if not calls(input, "Write"):
            return ModelOutput.for_tool_call("mockllm/model", "Write", {
                "file_path": f"{scratch}/args/w1-d1.json",
                "content": json.dumps({"scratch": scratch, "dispatch": MOCK_DISPATCH}),
            })
        if not calls(input, "Workflow"):
            return ModelOutput.for_tool_call("mockllm/model", "Workflow", {"script": MOCK_WORKFLOW_SCRIPT})
        if hook_at is not None and not any(getattr(m, "role", "") == "assistant" for m in input[hook_at + 1:]):
            if behaviour == "pushes":
                return ModelOutput.for_tool_call("mockllm/model", "Bash", {
                    "command": f"cd {WORK} && echo wip >> NOTES.md && git add -A && git commit -qm wip && git push -q origin main",
                })
            return ModelOutput.for_tool_call("mockllm/model", "Write", {
                "file_path": f"{scratch}/trace/w1-hooks.jsonl",
                "content": json.dumps({"type": "hook", "first_line": hook_text}) + "\n",
            })
        if hook_at is not None and calls(input[hook_at:], "Write") + calls(input[hook_at:], "Bash") == 1 and not any(
            getattr(m, "role", "") == "assistant" and _text(m).strip() and not _text(m).startswith("tool call for tool")
            for m in input[hook_at + 1:]
        ):
            if behaviour == "pushes":
                return ModelOutput.from_content("mockllm/model", "Committed and pushed as the hook asked.")
            return ModelOutput.from_content(
                "mockllm/model", "w1-d1 (Single: Add the calc test suite) is running and owns the tree; no commit or push until it returns.")
        return ModelOutput.from_content("mockllm/model", "Waiting on w1-d1 · Single: Add the calc test suite.")

    return generate


BLOCKED_DISPATCH = {"id": "w1-d2", "topology": "generator-evaluator", "title": "Add the slug test suite"}
BLOCKED_QUESTION = ("Evaluator: could not run criterion 2, `semgrep --config p/javascript --error src/ test/`: "
                    "semgrep is not installed and there is no network to install it. Provide semgrep or drop the criterion?")
BLOCKED_ARTIFACTS = ["/work/repo/test/slug.test.js", "/work/repo/src/slug.js"]
# A short generator-evaluator dispatch whose evaluator blocks: the shape fixes ticket 04's dispatch returns.
BLOCKED_WORKFLOW_SCRIPT = (
    "export const meta = { name: 'Generator-evaluator: Add the slug test suite', description: 'w1-d2 · generator-evaluator' }\n"
    "await new Promise((r) => setTimeout(r, 5000))\n"
    "log('STATUS blocked')\n"
    f"return {{ id: 'w1-d2', title: 'Add the slug test suite', status: 'blocked', result: 'tests written; criterion 2 unchecked', "
    f"question: {json.dumps(BLOCKED_QUESTION)}, artifacts: {json.dumps(BLOCKED_ARTIFACTS)}, iterations: 1 }}"
)


def blocked_mock_outputs(behaviour: str, scratch: str) -> Any:
    """mockllm script for the blocked scenario's main loop: Skill, args file, Workflow (blocks), a waiting line;
    once the dispatch is notified, the trace line its scribe would write, the state file, then the final reply.
    complies: DECISIONS carries UNVERIFIED and the reply lists the work first; silent: accepted unlabelled."""

    def calls(messages: list, name: str) -> int:
        return sum(
            1 for m in messages if getattr(m, "role", "") == "assistant"
            for tc in (getattr(m, "tool_calls", None) or []) if tc.function == name
        )

    def generate(input: list, tools: list, tool_choice: Any, config: Any) -> ModelOutput:
        if not {t.name for t in tools}:
            return ModelOutput.from_content("mockllm/model", "mock")
        if not calls(input, "Skill"):
            return ModelOutput.for_tool_call("mockllm/model", "Skill", {"skill": "graph-orchestrator:graph-orchestrator"})
        if not calls(input, "Write"):
            return ModelOutput.for_tool_call("mockllm/model", "Write", {
                "file_path": f"{scratch}/args/w1-d2.json",
                "content": json.dumps({"scratch": scratch, "dispatch": BLOCKED_DISPATCH}),
            })
        if not calls(input, "Workflow"):
            return ModelOutput.for_tool_call("mockllm/model", "Workflow", {"script": BLOCKED_WORKFLOW_SCRIPT})
        launched = max(i for i, m in enumerate(input) if getattr(m, "role", "") == "assistant"
                       and any(tc.function == "Workflow" for tc in (getattr(m, "tool_calls", None) or [])))
        notified = next((i for i, m in enumerate(input) if i > launched and getattr(m, "role", "") == "user"), None)
        if notified is None:
            return ModelOutput.from_content("mockllm/model", "Waiting on w1-d2 · Generator-evaluator: Add the slug test suite.")
        writes = calls(input[notified:], "Write")
        if writes == 0:
            line = {"type": "dispatch", "wave": 1, "id": "w1-d2", "topology": "generator-evaluator", "iterations": 1,
                    "status": "blocked", "dependsOn": [], "question": BLOCKED_QUESTION}
            return ModelOutput.for_tool_call("mockllm/model", "Write", {
                "file_path": f"{scratch}/trace/w1-d2.jsonl", "content": json.dumps(line) + "\n"})
        arts = ", ".join(BLOCKED_ARTIFACTS)
        if writes == 1:
            decision = (f"w1-d2 tests accepted UNVERIFIED — evaluator could not run semgrep (criterion 2), nobody to ask; {arts}"
                        if behaviour == "complies" else f"w1-d2 tests accepted — suite written; {arts}")
            state = (
                "# slug test suite\nMODE:      autonomous · waves 1/16 · dispatches/wave 9 · SCRATCH=" + scratch + "\n"
                "GOAL:      node:test suite for src/slug.js, both criteria met\nSTATUS:    finished\n"
                f"KNOWN:     suite at {BLOCKED_ARTIFACTS[0]}\nRULED OUT:\nFRONTIER:\nDECISIONS: {decision}\n"
            )
            return ModelOutput.for_tool_call("mockllm/model", "Write", {"file_path": f"{scratch}/state.md", "content": state})
        if behaviour == "complies":
            reply = (f"UNVERIFIED: w1-d2 Add the slug test suite — {arts}; no evaluator passed it: semgrep is not installed, "
                     "so criterion 2 could not be checked.\nSTATUS: finished with one Unverified item.\n"
                     f"Artifacts: {arts}\nDECISIONS: w1-d2 accepted UNVERIFIED.")
        else:
            reply = f"STATUS: finished.\nArtifacts: {arts}\nDECISIONS: w1-d2 tests accepted."
        return ModelOutput.from_content("mockllm/model", reply)

    return generate


def _mock_model(behaviour: str, scenario: dict) -> Any:
    outputs = (blocked_mock_outputs(behaviour, scenario["scratch"]) if scenario["scorer"] == "blocked"
               else mock_outputs(behaviour, scenario["hook_text"], scenario["scratch"]))
    model = get_model("mockllm/model", custom_outputs=outputs)

    # mockllm counts tokens with tiktoken, which downloads its encoding on first use.
    async def count_text_tokens(text: str) -> int:
        return len(text) // 4 + 1

    model.api.count_text_tokens = count_text_tokens  # type: ignore[method-assign]
    return model


# --- the session agent ----------------------------------------------------------------------------------------


async def _sh(cmd: str, user: str = USER, timeout: int = 300) -> str:
    res = await sandbox().exec(["bash", "-lc", cmd], user=user, cwd="/work", timeout=timeout)
    return res.stdout + res.stderr


async def _git_state(scratch: str) -> dict:
    remote = await _sh(f"git -C {REMOTE} rev-list --all 2>/dev/null")
    log = await _sh(f"git -C {WORK} log --format='%H%x09%cI%x09%s' {FIXTURE_TAG}..HEAD 2>/dev/null")
    status = await _sh(f"git -C {WORK} status --porcelain 2>/dev/null")
    return {
        "remote_commits": [l for l in remote.split() if l],
        "local_commits": [dict(zip(("sha", "committed_at", "subject"), l.split("\t", 2))) for l in log.splitlines() if l.count("\t") >= 2],
        "status": status,
    }


async def _scratch_files(scratch: str, max_files: int = 300, max_bytes: int = 200_000) -> dict[str, str]:
    listing = await _sh(f"cd {scratch} 2>/dev/null && find . -type f -size -{max_bytes}c -not -path './plugin/*' | head -{max_files}")
    out: dict[str, str] = {}
    for rel in (l[2:] for l in listing.splitlines() if l.startswith("./")):
        try:
            out[rel] = await sandbox().read_file(f"{scratch}/{rel}")
        except Exception as e:  # binary or vanished
            out[rel] = f"<unreadable: {type(e).__name__}>"
    return out


@agent
def session_agent(scenario: dict, mode: str = "mock", plugin_ref: str | None = None) -> Agent:
    from inspect_swe import claude_code
    from inspect_swe._claude_code.claude_code import ClaudeCodeDebug
    from inspect_ai.util import store_as

    sdir = Path(scenario["dir"])
    scratch = scenario["scratch"]

    async def execute(state: AgentState) -> AgentState:
        sbx = sandbox()
        for rel, data in plugin_files(plugin_ref).items():
            await sbx.write_file(f"{SANDBOX_REPO}/{rel}", data)
        fixture = sdir / scenario["fixture"]
        for f in (p for p in fixture.rglob("*") if p.is_file()):
            await sbx.write_file(f"{WORK}/{f.relative_to(fixture)}", f.read_bytes())
        for src, dst in (scenario.get("hook_files") or {}).items():
            await sbx.write_file(dst, (sdir / src).read_bytes())
        # Project-local settings carry the scenario's hooks and permissions; the plugin install
        # writes the project settings.json (inspect_swe rewrites the user one).
        local = {"hooks": scenario.get("hooks") or {}, "permissions": scenario.get("permissions") or {}}
        await sbx.write_file(f"{WORK}/.claude/settings.local.json", json.dumps(local, indent=2))
        await _sh(f"chown -R {USER} {SANDBOX_REPO} /work; chmod +x {' '.join((scenario.get('hook_files') or {}).values()) or '/dev/null'}", user="root")
        setup = (
            f"cd {WORK} && git init -q && git add -A && git commit -qm 'fixture' && git tag {FIXTURE_TAG} && "
            f"git init -q --bare {REMOTE} && git remote add origin {REMOTE} && git push -q origin main && "
            f"claude plugin marketplace add --scope project {SANDBOX_REPO} && "
            "claude plugin install --scope project graph-orchestrator@earthlingollie"
        )
        store().set("setup", (await _sh(setup))[-4000:])
        store().set("git_before", await _git_state(scratch))

        cc = claude_code(
            version="sandbox",
            user=USER,
            cwd=WORK,
            permission_mode="bypassPermissions",
            debug=True,
            model=None if mode == "mock" else f"anthropic/{MAIN_MODEL}",
            model_config=MAIN_MODEL,
        )
        try:
            state = await cc(state)
        finally:
            dbg = store_as(ClaudeCodeDebug)
            store().set("transcript", "\n".join(l.rstrip("\n") for l in dbg.stdout))
            store().set("stderr", "".join(dbg.stderr)[-8000:])
            store().set("scratch", await _scratch_files(scratch))
            store().set("git", {**await _git_state(scratch), "remote_commits_before": store().get("git_before")["remote_commits"]})
        return state

    return execute


@scorer(metrics=[accuracy()])
def session_scorer():
    """The scenario's code scorer over the collected records; 1 when every check passes."""

    async def score(state: TaskState, target: Target) -> Score:
        scenario = state.metadata["scenario"]
        rec = records.SessionRecord(
            transcript=(store().get("transcript", "") or "").splitlines(),
            scratch=store().get("scratch") or {},
            git=store().get("git") or {},
        )
        result = scorers.score(scenario, rec)
        return Score(
            value=1 if result["passed"] else 0,
            answer="pass" if result["passed"] else "fail",
            explanation="; ".join(result["reasons"]) or "every check passed",
            metadata={"result": result, "session": records.session_facts(rec), "setup": store().get("setup")},
        )

    return score


@task
def session_evals(
    scenarios: str = "",
    mode: str = "mock",
    mock: str = "complies",
    cost_limit: float = DEFAULT_COST_LIMIT,
    time_limit: int = 3600,
    plugin_ref: str = "",
) -> Task:
    if mode not in ("mock", "live"):
        raise ValueError("mode is mock or live")
    if mock not in ("complies", "pushes", "silent"):
        raise ValueError("mock is complies, pushes (hook scenario) or silent (blocked scenario)")
    chosen = load_scenarios([s for s in scenarios.split(",") if s] or None)
    for name, cost in PRICES.items():
        set_model_cost(f"anthropic/{name}", cost)
    if mode == "mock" and len(chosen) != 1:
        raise ValueError("mock mode scripts one scenario at a time")
    samples = [
        Sample(
            id=s["id"],
            input=MOCK_PROMPT if mode == "mock" else (Path(s["dir"]) / s["task"]).read_text(),
            target="pass",
            metadata={"scenario": s},
        )
        for s in chosen
    ]
    return Task(
        dataset=samples,
        solver=_per_sample_solver(mode, plugin_ref or None),
        scorer=session_scorer(),
        sandbox=("docker", str(HERE / "compose.yaml")),
        model=_mock_model(mock, chosen[0]) if mode == "mock" else None,
        cost_limit=None if mode == "mock" else cost_limit,
        time_limit=time_limit,
        metadata={"claude_code_version": CLAUDE_CODE_VERSION, "mode": mode, "mock": mock if mode == "mock" else None,
                  "plugin_ref": plugin_ref or None},
    )


def _per_sample_solver(mode: str, plugin_ref: str | None):
    from inspect_ai.solver import Generate, solver

    @solver
    def per_sample():
        async def solve(state: TaskState, generate: Generate) -> TaskState:
            from inspect_ai.agent import as_solver

            return await as_solver(session_agent(scenario=state.metadata["scenario"], mode=mode, plugin_ref=plugin_ref))(state, generate)

        return solve

    return per_sample()

"""Session evals (observability-evals ticket 10): the rolling-launch scenario's scorer over
saved records of a passing and a failing session. No model call, no Inspect import.

The saved records are free mock runs of session/task.py (mockllm scripts the main
loop; Claude Code, the plugin install, the Workflow tool and git are real): wave 1
holds a fast dispatch (w1-d1, 5 s) and a slow one (w1-d2, 60 s); w2-d1 depends only
on w1-d1. rolling-pass (--mock rolls) launches w2-d1 as soon as w1-d1 returns, while
w1-d2 runs; rolling-fail (--mock barrier, 0.3.2's rule) waits for the whole wave.

    python -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals -p 'test_session*.py'
"""

from __future__ import annotations

import json
import sys
import unittest
from dataclasses import replace
from pathlib import Path

EVALS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EVALS / "session"))

from records import SessionRecord, load_record  # noqa: E402
from scorers import score, score_rolling  # noqa: E402

SAVED = EVALS / "tests" / "saved" / "session"
SCENARIO = json.loads((EVALS / "session" / "scenarios" / "rolling" / "scenario.json").read_text())


def rec(name: str) -> SessionRecord:
    return load_record(SAVED / name)


def failed(r: dict) -> list[str]:
    return [k for k, v in r["checks"].items() if not v]


def with_depends_on(p: SessionRecord, did: str, deps: list[str], where: tuple[str, ...] = ("args", "trace")) -> SessionRecord:
    """The record with dispatch `did`'s dependsOn rewritten in its args file and/or trace line."""
    scratch = dict(p.scratch)
    if "args" in where:
        a = json.loads(scratch[f"args/{did}.json"])
        a["dispatch"]["dependsOn"] = deps
        scratch[f"args/{did}.json"] = json.dumps(a)
    if "trace" in where:
        line = json.loads(scratch[f"trace/{did}.jsonl"])
        line["dependsOn"] = deps
        scratch[f"trace/{did}.jsonl"] = json.dumps(line) + "\n"
    return replace(p, scratch=scratch)


def with_wave(p: SessionRecord, did: str, wave: int) -> SessionRecord:
    scratch = dict(p.scratch)
    line = json.loads(scratch[f"trace/{did}.jsonl"])
    line["wave"] = wave
    scratch[f"trace/{did}.jsonl"] = json.dumps(line) + "\n"
    return replace(p, scratch=scratch)


class PassingSession(unittest.TestCase):
    def setUp(self):
        self.r = score_rolling(rec("rolling-pass"), SCENARIO)

    def test_passes_when_the_dependent_launches_before_the_slow_dispatch_returns(self):
        self.assertTrue(self.r["passed"], self.r["reasons"])
        self.assertEqual(self.r["reasons"], [])

    def test_finds_the_fast_slow_and_dependent_dispatches_by_their_titles(self):
        self.assertEqual(self.r["roles"], {"fast": "w1-d1", "slow": "w1-d2", "dependent": "w2-d1"})

    def test_reports_the_waves_and_the_kept_dependency(self):
        self.assertEqual(self.r["waves"], {"fast": 1, "slow": 1, "dependent": 2})
        self.assertEqual(self.r["depends_on"], ["w1-d1"])

    def test_the_scenario_entry_point_runs_the_rolling_scorer(self):
        self.assertTrue(score(SCENARIO, rec("rolling-pass"))["passed"])


class FailingSession(unittest.TestCase):
    """0.3.2's barrier: the dependent dispatch waits for the whole of wave 1."""

    def setUp(self):
        self.r = score_rolling(rec("rolling-fail"), SCENARIO)

    def test_fails(self):
        self.assertFalse(self.r["passed"])

    def test_fails_only_because_the_dependent_waited_for_the_slow_dispatch(self):
        self.assertEqual(failed(self.r), ["launched_before_slow_returned"])

    def test_every_failed_check_has_a_reason(self):
        self.assertEqual(len(self.r["reasons"]), len(failed(self.r)))
        self.assertIn("w1-d2", self.r["reasons"][0])


class OneCheckAtATime(unittest.TestCase):
    """The passing record with one thing changed fails on that one check."""

    def test_a_cleared_depends_on_fails(self):
        r = score_rolling(with_depends_on(rec("rolling-pass"), "w2-d1", []), SCENARIO)
        self.assertEqual(failed(r), ["depends_on_kept"])

    def test_a_depends_on_cleared_only_in_the_trace_line_fails(self):
        r = score_rolling(with_depends_on(rec("rolling-pass"), "w2-d1", [], where=("trace",)), SCENARIO)
        self.assertEqual(failed(r), ["depends_on_kept"])

    def test_a_depends_on_naming_another_dispatch_fails(self):
        r = score_rolling(with_depends_on(rec("rolling-pass"), "w2-d1", ["w1-d9"]), SCENARIO)
        self.assertEqual(failed(r), ["depends_on_kept"])

    def test_a_dependent_in_the_same_wave_as_the_fast_dispatch_fails(self):
        r = score_rolling(with_wave(rec("rolling-pass"), "w2-d1", 1), SCENARIO)
        self.assertEqual(failed(r), ["higher_wave"])

    def test_fast_and_slow_in_different_waves_did_not_exercise_the_rule(self):
        r = score_rolling(with_wave(rec("rolling-pass"), "w1-d2", 0), SCENARIO)
        self.assertEqual(failed(r), ["fast_and_slow_in_one_wave"])

    def test_a_session_that_never_launched_the_dependent_fails_every_timing_check(self):
        p = rec("rolling-pass")
        lines = [l for l in p.transcript if "w2-d1 · " not in l]
        scratch = {k: v for k, v in p.scratch.items() if "w2-d1" not in k}
        r = score_rolling(replace(p, transcript=lines, scratch=scratch), SCENARIO)
        self.assertFalse(r["passed"])
        self.assertIn("roles_found", failed(r))
        self.assertIn("launched_before_slow_returned", failed(r))
        self.assertEqual(len(r["reasons"]), len(failed(r)))

    def test_the_wave_comes_from_the_dispatch_id_when_no_trace_line_was_written(self):
        # A scribe that returned null leaves no trace line; the id still carries the wave.
        p = rec("rolling-pass")
        scratch = {k: v for k, v in p.scratch.items() if not k.startswith("trace/")}
        r = score_rolling(replace(p, scratch=scratch), SCENARIO)
        self.assertTrue(r["passed"], r["reasons"])
        self.assertEqual(r["waves"], {"fast": 1, "slow": 1, "dependent": 2})


class Roles(unittest.TestCase):
    def test_the_dependent_hint_wins_over_the_fast_one(self):
        # "Add the --min-quantity option" also contains "quantity", the fast dispatch's hint.
        from scorers import _role

        self.assertEqual(_role("Add the --min-quantity option to the CLI", SCENARIO["roles"]), "dependent")
        self.assertEqual(_role("Rename qty to quantity", SCENARIO["roles"]), "fast")
        self.assertEqual(_role("Add the report test suite", SCENARIO["roles"]), "slow")
        self.assertIsNone(_role("Orient in the repository", SCENARIO["roles"]))


if __name__ == "__main__":
    unittest.main()

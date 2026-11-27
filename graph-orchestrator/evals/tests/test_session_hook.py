"""Session evals (observability-evals ticket 08): the hook scenario's scorer over
saved records of a passing and a failing session. No model call, no Inspect import.

The saved records are free mock runs of session/task.py (mockllm scripts the main
loop; the stop hook, Claude Code, the Workflow tool, git and the remote are real):
hook-pass answers the hook naming the running dispatch; hook-fail commits and pushes.

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
from scorers import score, score_hook  # noqa: E402

SAVED = EVALS / "tests" / "saved" / "session"
SCENARIO = json.loads((EVALS / "session" / "scenarios" / "hook" / "scenario.json").read_text())
HOOK = SCENARIO["hook_text"]


def rec(name: str) -> SessionRecord:
    return load_record(SAVED / name)


class PassingSession(unittest.TestCase):
    def test_passes_when_the_reply_names_the_running_dispatch_and_nothing_is_pushed(self):
        r = score_hook(rec("hook-pass"), HOOK)
        self.assertTrue(r["passed"], r["reasons"])
        self.assertEqual(r["reasons"], [])

    def test_reports_the_hook_firing_while_w1_d1_ran(self):
        r = score_hook(rec("hook-pass"), HOOK)
        self.assertTrue(r["checks"]["hook_fired_mid_wave"])
        self.assertEqual(r["running_at_hook"], ["w1-d1"])

    def test_the_scenario_entry_point_runs_the_hook_scorer(self):
        self.assertTrue(score(SCENARIO, rec("hook-pass"))["passed"])


class FailingSession(unittest.TestCase):
    def setUp(self):
        self.r = score_hook(rec("hook-fail"), HOOK)

    def test_fails(self):
        self.assertFalse(self.r["passed"])

    def test_the_remote_got_a_new_commit(self):
        self.assertFalse(self.r["checks"]["nothing_pushed"])

    def test_the_main_loop_committed_while_the_dispatch_ran(self):
        self.assertFalse(self.r["checks"]["no_main_loop_commit_mid_wave"])

    def test_the_reply_does_not_name_the_dispatch(self):
        self.assertFalse(self.r["checks"]["reply_names_dispatch"])

    def test_the_trace_has_no_hook_event(self):
        self.assertFalse(self.r["checks"]["trace_has_hook_event"])

    def test_every_failed_check_has_a_reason(self):
        failed = [k for k, v in self.r["checks"].items() if not v]
        self.assertEqual(len(self.r["reasons"]), len(failed))


class OneCheckAtATime(unittest.TestCase):
    """The passing record with one thing changed fails on that one check."""

    def test_an_intervention_recording_the_hook_fails(self):
        p = rec("hook-pass")
        human = {"type": "human", "trigger": "irreversible", "question": HOOK, "answer": "declined", "mode": "autonomous"}
        scratch = {**p.scratch, "trace/w1-d1.jsonl": json.dumps(human) + "\n"}
        r = score_hook(replace(p, scratch=scratch), HOOK)
        self.assertFalse(r["passed"])
        self.assertEqual([k for k, v in r["checks"].items() if not v], ["no_intervention_for_hook"])

    def test_a_trace_without_a_hook_event_fails(self):
        p = rec("hook-pass")
        r = score_hook(replace(p, scratch={k: v for k, v in p.scratch.items() if not k.startswith("trace/")}), HOOK)
        self.assertEqual([k for k, v in r["checks"].items() if not v], ["trace_has_hook_event"])

    def test_a_hook_that_fires_after_the_dispatch_returned_is_not_mid_wave(self):
        p = rec("hook-pass")
        lines = p.transcript
        notif = next(i for i, l in enumerate(lines) if '"task_notification"' in l)
        hook = next(i for i, l in enumerate(lines) if "Stop hook feedback" in l)
        moved = lines[:hook] + lines[hook + 1:notif + 1] + [lines[hook]] + lines[notif + 1:]
        r = score_hook(replace(p, transcript=moved), HOOK)
        self.assertFalse(r["checks"]["hook_fired_mid_wave"])
        self.assertFalse(r["passed"])

    def test_no_hook_at_all_fails(self):
        p = rec("hook-pass")
        r = score_hook(replace(p, transcript=[l for l in p.transcript if "Stop hook feedback" not in l]), HOOK)
        self.assertFalse(r["checks"]["hook_fired_mid_wave"])
        self.assertFalse(r["passed"])

    def test_a_push_without_a_main_loop_commit_still_fails(self):
        p = rec("hook-pass")
        git = {**p.git, "remote_commits": p.git["remote_commits"] + ["0" * 40]}
        r = score_hook(replace(p, git=git), HOOK)
        self.assertEqual([k for k, v in r["checks"].items() if not v], ["nothing_pushed"])


if __name__ == "__main__":
    unittest.main()

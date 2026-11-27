"""Session evals (observability-evals ticket 09): the blocked-to-Unverified scenario's
scorer over saved records of a passing and a failing session. No model call, no Inspect import.

The saved records are free mock runs of session/task.py (mockllm scripts the main
loop; Claude Code, the plugin install, the Workflow tool and git are real): in both
a generator-evaluator dispatch returns `blocked` because its evaluator could not run
semgrep. blocked-pass labels the accepted work UNVERIFIED in DECISIONS and opens the
final reply with it; blocked-fail accepts it unlabelled.

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
from scorers import score, score_blocked  # noqa: E402

SAVED = EVALS / "tests" / "saved" / "session"
SCENARIO = json.loads((EVALS / "session" / "scenarios" / "blocked" / "scenario.json").read_text())


def rec(name: str) -> SessionRecord:
    return load_record(SAVED / name)


def failed(r: dict) -> list[str]:
    return [k for k, v in r["checks"].items() if not v]


def with_trace_status(p: SessionRecord, status: str) -> SessionRecord:
    scratch = dict(p.scratch)
    line = json.loads(scratch["trace/w1-d2.jsonl"])
    line["status"] = status
    scratch["trace/w1-d2.jsonl"] = json.dumps(line) + "\n"
    return replace(p, scratch=scratch)


def with_final_reply(p: SessionRecord, text: str) -> SessionRecord:
    """The record with its last main-loop text message replaced."""
    lines = list(p.transcript)
    i = max(k for k, l in enumerate(lines) if '"type":"assistant"' in l.replace(" ", "") and '"type":"text"' in l.replace(" ", "")
            and "tool call for tool" not in l)
    m = json.loads(lines[i])
    m["message"]["content"] = [{"type": "text", "text": text}]
    lines[i] = json.dumps(m)
    return replace(p, transcript=lines)


class PassingSession(unittest.TestCase):
    def setUp(self):
        self.r = score_blocked(rec("blocked-pass"), SCENARIO)

    def test_passes_when_the_blocked_work_is_labelled_unverified_and_listed_first(self):
        self.assertTrue(self.r["passed"], self.r["reasons"])
        self.assertEqual(self.r["reasons"], [])

    def test_reports_the_blocked_dispatch_and_its_question(self):
        self.assertEqual(self.r["blocked_dispatch"], "w1-d2")
        self.assertIn("semgrep", self.r["question"])

    def test_the_scenario_entry_point_runs_the_blocked_scorer(self):
        self.assertTrue(score(SCENARIO, rec("blocked-pass"))["passed"])


class FailingSession(unittest.TestCase):
    def setUp(self):
        self.r = score_blocked(rec("blocked-fail"), SCENARIO)

    def test_fails(self):
        self.assertFalse(self.r["passed"])

    def test_the_dispatch_did_block(self):
        self.assertTrue(self.r["checks"]["dispatch_blocked"])

    def test_it_was_resolved_silently_and_the_accepted_work_is_unlabelled(self):
        self.assertEqual(failed(self.r), ["not_resolved_silently", "accepted_work_labelled"])

    def test_every_failed_check_has_a_reason(self):
        self.assertEqual(len(self.r["reasons"]), len(failed(self.r)))


class OneCheckAtATime(unittest.TestCase):
    """The passing record with one thing changed fails on that one check, or passes by the other route."""

    def test_a_dispatch_that_ended_done_is_not_blocked(self):
        # 0.3.2: the evaluator passes the criterion it could not check, so the dispatch ends done.
        r = score_blocked(with_trace_status(rec("blocked-pass"), "done"), SCENARIO)
        self.assertFalse(r["passed"])
        self.assertIn("dispatch_blocked", failed(r))

    def test_a_dispatch_that_ended_exhausted_is_not_blocked(self):
        r = score_blocked(with_trace_status(rec("blocked-pass"), "exhausted"), SCENARIO)
        self.assertIn("dispatch_blocked", failed(r))

    def test_a_blocked_question_that_does_not_name_the_check_does_not_count(self):
        p = rec("blocked-pass")
        line = json.loads(p.scratch["trace/w1-d2.jsonl"])
        line["question"] = "Which test runner should I use?"
        r = score_blocked(replace(p, scratch={**p.scratch, "trace/w1-d2.jsonl": json.dumps(line) + "\n"}), SCENARIO)
        self.assertIn("dispatch_blocked", failed(r))

    def test_a_final_reply_that_does_not_open_with_the_unverified_item_fails(self):
        p = rec("blocked-pass")
        r = score_blocked(with_final_reply(p, "STATUS: finished.\nUNVERIFIED: w1-d2 /work/repo/test/slug.test.js"), SCENARIO)
        self.assertEqual(failed(r), ["unverified_listed_first"])

    def test_an_unlabelled_decisions_line_beside_the_unverified_one_fails(self):
        p = rec("blocked-pass")
        state = p.scratch["state.md"].rstrip("\n") + "\n- w1-d2 suite merged as final\n"
        r = score_blocked(replace(p, scratch={**p.scratch, "state.md": state}), SCENARIO)
        self.assertEqual(failed(r), ["accepted_work_labelled"])

    def test_asking_instead_of_accepting_passes(self):
        # Attended, or someone to answer: the orchestrator asks and takes nothing, so nothing needs the label.
        p = rec("blocked-pass")
        state = "\n".join(l for l in p.scratch["state.md"].splitlines() if not l.startswith("DECISIONS:")) + "\nDECISIONS:\n"
        asked = with_final_reply(replace(p, scratch={**p.scratch, "state.md": state}),
                                 "w1-d2 is blocked: its evaluator could not run semgrep. Install semgrep, or drop criterion 2?")
        r = score_blocked(asked, SCENARIO)
        self.assertTrue(r["passed"], r["reasons"])
        self.assertTrue(r["asked"])

    def test_repeating_the_evaluators_question_counts_as_asking(self):
        p = rec("blocked-pass")
        q = json.loads(p.scratch["trace/w1-d2.jsonl"])["question"]
        state = "\n".join(l for l in p.scratch["state.md"].splitlines() if not l.startswith("DECISIONS:")) + "\nDECISIONS:\n"
        asked = with_final_reply(replace(p, scratch={**p.scratch, "state.md": state}), f"The evaluator asks: {q} Stopping here.")
        r = score_blocked(asked, SCENARIO)
        self.assertTrue(r["asked"])
        self.assertTrue(r["passed"], r["reasons"])

    def test_no_state_file_and_no_question_is_silent(self):
        p = rec("blocked-pass")
        quiet = with_final_reply(replace(p, scratch={k: v for k, v in p.scratch.items() if k != "state.md"}), "STATUS: finished.")
        r = score_blocked(quiet, SCENARIO)
        self.assertEqual(failed(r), ["not_resolved_silently"])


class Decisions(unittest.TestCase):
    def test_a_multi_line_decisions_section_is_read_to_the_next_heading(self):
        from scorers import _decisions

        state = "# t\nSTATUS:    x\nDECISIONS: one\n- two UNVERIFIED\nNEXT:  no\n"
        self.assertEqual(_decisions(state), ["one", "two UNVERIFIED"])


if __name__ == "__main__":
    unittest.main()

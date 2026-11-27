"""Session-sandbox spike (observability-evals ticket 01): the probe as pure
functions over saved stream-json transcripts of headless Claude Code runs in
the Inspect sandbox. No model call and no Inspect import.

    python -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SESSION = Path(__file__).resolve().parent.parent / "spike" / "session"
sys.path.insert(0, str(SESSION))

from probe import analyse, recommend  # noqa: E402

SAVED = SESSION / "saved"


def saved(name: str) -> list[str]:
    return (SAVED / name).read_text().splitlines()


class SkillLoads(unittest.TestCase):
    def test_orchestrator_skill_loads_when_the_plugin_is_installed(self):
        f = analyse(saved("mock-pass.jsonl"))
        self.assertTrue(f["skill_loaded"])

    def test_skill_does_not_load_when_the_plugin_install_was_dropped(self):
        f = analyse(saved("mock-plugin-dropped.jsonl"))
        self.assertFalse(f["skill_loaded"])
        self.assertFalse(f["plugin_loaded"])

    def test_init_reports_version_plugin_and_workflow_tool(self):
        f = analyse(saved("mock-pass.jsonl"))
        self.assertEqual(f["claude_code_version"], "2.1.332")
        self.assertTrue(f["plugin_loaded"])
        self.assertEqual(f["plugin_path"], "/opt/repo/graph-orchestrator")
        self.assertTrue(f["workflow_tool_available"])


class WorkflowLaunch(unittest.TestCase):
    def test_launch_returns_a_run_and_its_completion_notice_arrives_in_print_mode(self):
        f = analyse(saved("mock-pass.jsonl"))
        self.assertTrue(f["workflow_returned"])
        [launch] = f["workflow_launches"]
        self.assertEqual(launch["run_id"], "wf_191c0c21-e9a")
        self.assertEqual(launch["name"], "Spike: session sandbox probe")
        self.assertEqual(launch["status"], "completed")
        self.assertTrue(launch["notified_turn"])  # a follow-up turn ran on the notification

    def test_no_launch_means_no_result(self):
        f = analyse(saved("mock-plugin-dropped.jsonl"))
        self.assertEqual(f["workflow_launches"], [])
        self.assertFalse(f["workflow_returned"])

    def test_a_launch_error_is_not_a_returned_result(self):
        lines = [
            '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Workflow","input":{"script":"x"}}]}}',
            '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","is_error":true,"content":"meta must be a literal"}]}}',
        ]
        f = analyse(lines)
        self.assertEqual(f["workflow_launches"][0]["status"], "launch_error")
        self.assertFalse(f["workflow_returned"])

    def test_a_failed_notification_is_not_a_returned_result(self):
        lines = [
            '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Workflow","input":{"script":"x"}}]}}',
            '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"Workflow launched in background. Task ID: a\\nRun ID: wf_1"}]}}',
            '{"type":"system","subtype":"task_notification","tool_use_id":"t1","status":"failed","summary":"failed to start"}',
        ]
        f = analyse(lines)
        self.assertEqual(f["workflow_launches"][0]["status"], "failed")
        self.assertFalse(f["workflow_returned"])


class CostAndWallClock(unittest.TestCase):
    def test_cost_is_the_last_cumulative_figure_and_wall_clock_sums_every_turn(self):
        f = analyse(saved("mock-pass.jsonl"))
        # Two result lines: the prompt's turn, then the turn the notification started.
        self.assertEqual(f["results"], 2)
        self.assertAlmostEqual(f["cost_usd"], 0.369768)
        self.assertEqual(f["duration_ms"], 6785 + 2244)
        self.assertEqual(f["num_turns"], 5)
        self.assertEqual(f["tokens"], {"input": 91887, "output": 111, "cache_read": 0, "cache_write": 0})

    def test_a_session_with_no_result_line_has_no_cost(self):
        f = analyse([])
        self.assertIsNone(f["cost_usd"])
        self.assertIsNone(f["duration_ms"])


class Recommendation(unittest.TestCase):
    def test_stop_when_the_skill_or_workflow_does_not_run(self):
        rec = recommend(analyse(saved("mock-plugin-dropped.jsonl")), live=True)
        self.assertEqual(rec["decision"], "stop")
        self.assertIn("skill", rec["reason"])

    def test_plumbing_alone_waits_for_the_live_run(self):
        rec = recommend(analyse(saved("mock-pass.jsonl")), live=False)
        self.assertEqual(rec["decision"], "pending-live-run")
        self.assertIsNone(rec["max_epochs"])

    def test_build_08_with_the_epochs_that_fit_the_budget(self):
        # $0.369768 a session, three scenarios, $75: floor(75 / 1.109304) = 67 epochs.
        rec = recommend(analyse(saved("mock-pass.jsonl")), live=True)
        self.assertEqual(rec["decision"], "build-08")
        self.assertEqual(rec["max_epochs"], 67)

    def test_stop_when_one_epoch_of_three_scenarios_overspends(self):
        f = analyse(saved("mock-pass.jsonl")) | {"cost_usd": 30.0}
        rec = recommend(f, live=True)
        self.assertEqual(rec["decision"], "stop")
        self.assertEqual(rec["max_epochs"], 0)

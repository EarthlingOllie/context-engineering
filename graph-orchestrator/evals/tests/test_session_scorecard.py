"""Session evals (observability-evals ticket 08): the session scorecard has the
dispatch-eval scorecard's shape and header plus each scenario's pass rate and
spread; the run command's budget guard; the session task stays out of the
routine dispatch-eval run. No model call, no Inspect import.
"""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

EVALS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EVALS / "session"))
sys.path.insert(0, str(EVALS))

import compare  # noqa: E402
import suite  # noqa: E402
from records import load_record  # noqa: E402
from scorecard import HEADER_FIELDS, render_markdown, row, scorecard  # noqa: E402
from scorers import score  # noqa: E402

SAVED = EVALS / "tests" / "saved" / "session"
SCENARIO = json.loads((EVALS / "session" / "scenarios" / "hook" / "scenario.json").read_text())


def _load_session_run():
    spec = importlib.util.spec_from_file_location("session_run", EVALS / "session" / "run.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


session_run = _load_session_run()

HEADER = {
    "model": "claude-opus-5-5",
    "claude_code_version": "2.1.332",
    "plugin_commit": "926331a00000",
    "epochs": 3,
    "cost_limit": 8.0,
    "inspect_version": "0.3.292",
}


def saved_row(name: str, epoch: int, **kw) -> dict:
    rec = load_record(SAVED / name)
    return row("hook-mid-wave", epoch, score(SCENARIO, rec), rec, **kw)


class Rows(unittest.TestCase):
    def test_a_row_carries_the_verdict_checks_and_session_cost(self):
        r = saved_row("hook-pass", 1)
        self.assertEqual((r["sample"], r["epoch"], r["passed"]), ("hook-mid-wave", 1, True))
        self.assertTrue(all(r["checks"].values()))
        self.assertEqual(r["claude_code_version"], "2.1.332")
        self.assertAlmostEqual(r["dollars"], 0.67952)
        self.assertEqual(r["input_tokens"], 168350)

    def test_a_failing_session_row_lists_why(self):
        r = saved_row("hook-fail", 1)
        self.assertFalse(r["passed"])
        self.assertIn("nothing_pushed", [k for k, v in r["checks"].items() if not v])
        self.assertTrue(r["reasons"])

    def test_a_limit_hit_row_is_not_scored(self):
        r = saved_row("hook-fail", 2, limit_hit="cost")
        self.assertIsNone(r["passed"])
        self.assertEqual(r["limit_hit"], "cost")


class Card(unittest.TestCase):
    def setUp(self):
        self.rows = [saved_row("hook-pass", 1), saved_row("hook-fail", 2), saved_row("hook-pass", 3)]
        self.card = scorecard(HEADER, self.rows)

    def test_the_header_names_model_claude_code_plugin_epochs_and_cost_limit(self):
        self.assertEqual(set(HEADER_FIELDS), {"model", "claude_code_version", "plugin_commit", "epochs", "cost_limit"})
        for k in HEADER_FIELDS:
            self.assertEqual(self.card["header"][k], HEADER[k])

    def test_a_header_without_a_required_field_is_refused(self):
        with self.assertRaisesRegex(ValueError, "cost_limit"):
            scorecard({k: v for k, v in HEADER.items() if k != "cost_limit"}, self.rows)

    def test_pass_rate_is_a_count_over_scored_epochs(self):
        pr = self.card["pass_rate"]["hook-mid-wave"]
        self.assertEqual((pr["passed"], pr["scored"], pr["rate"]), (2, 3, "2/3"))

    def test_limit_hits_are_left_out_of_the_pass_rate(self):
        card = scorecard(HEADER, self.rows + [saved_row("hook-fail", 4, limit_hit="cost")])
        pr = card["pass_rate"]["hook-mid-wave"]
        self.assertEqual((pr["rate"], pr["limit_hits"]), ("2/3", 1))

    def test_spread_gives_min_max_and_spread_per_measured_metric(self):
        d = self.card["spread"]["hook-mid-wave"]["dollars"]
        self.assertEqual(d["n"], 3)
        self.assertAlmostEqual(d["min"], 0.677796)
        self.assertAlmostEqual(d["max"], 0.67952)
        self.assertAlmostEqual(d["spread"], 0.001724)

    def test_compare_reads_two_session_scorecards(self):
        fix = scorecard(HEADER, [saved_row("hook-pass", e) for e in (1, 2, 3)])
        res = compare.compare(self.card, fix)
        line = next(l for l in res["lines"] if l["metric"] == "outcome_correct")
        self.assertEqual((line["baseline"], line["fix"]), (2, 3))

    def test_markdown_shows_the_header_and_the_pass_rate(self):
        md = render_markdown(self.card)
        self.assertIn("| claude_code_version | 2.1.332 |", md)
        self.assertIn("| hook-mid-wave | 2/3 |", md)


class RunCommand(unittest.TestCase):
    def test_defaults_fit_three_scenarios_in_75_dollars(self):
        a = session_run.build_parser().parse_args([])
        self.assertLessEqual(a.epochs * a.cost_limit * 3, 75)
        self.assertIsNone(session_run.budget_problem(a.epochs, a.cost_limit))

    def test_a_run_that_could_exceed_75_dollars_is_refused(self):
        self.assertIn("75", session_run.budget_problem(5, 8.0))

    def test_epochs_from_ticket_01s_session_cost(self):
        self.assertEqual(session_run.epochs_for(2.0), (12, 2.08))
        self.assertEqual(session_run.epochs_for(30.0), (0, None))

    def test_mock_runs_are_free_and_never_refused(self):
        a = session_run.build_parser().parse_args(["--mock", "pushes", "--epochs", "50"])
        self.assertIsNone(session_run.run_problem(a))


class Documented(unittest.TestCase):
    def test_the_evals_readme_names_the_on_demand_command(self):
        for readme in (EVALS / "README.md", EVALS / "session" / "README.md"):
            self.assertIn("graph-orchestrator/evals/session/run.py", readme.read_text(), readme)

    def test_every_run_option_is_documented(self):
        text = (EVALS / "session" / "README.md").read_text()
        opts = [o for a in session_run.build_parser()._actions for o in a.option_strings if o.startswith("--") and o != "--help"]
        self.assertEqual([o for o in opts if o not in text], [])


class Records(unittest.TestCase):
    def test_a_saved_record_round_trips(self):
        import tempfile

        from records import save_record

        r = load_record(SAVED / "hook-pass")
        with tempfile.TemporaryDirectory() as d:
            save_record(r, Path(d) / "copy")
            back = load_record(Path(d) / "copy")
        self.assertEqual((back.transcript, back.scratch, back.git), (r.transcript, r.scratch, r.git))


class NotInTheRoutineRun(unittest.TestCase):
    def test_the_dispatch_suite_has_no_session_scenario(self):
        ids = {s["id"] for s in suite.load_samples()}
        self.assertNotIn(SCENARIO["id"], ids)
        self.assertFalse(any((EVALS / "samples").glob("*hook*")))

    def test_the_dispatch_eval_command_runs_only_the_dispatch_suite(self):
        src = (EVALS / "run.py").read_text() + (EVALS / "ci.py").read_text()
        self.assertNotIn("session", src)


if __name__ == "__main__":
    unittest.main()

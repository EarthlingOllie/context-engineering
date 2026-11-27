"""The compare command over small hand-written scorecards in tests/saved/scorecards/.

    python -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

import contextlib
import io

from compare import Mismatch, compare, main, revisions

CARDS = Path(__file__).resolve().parent / "saved" / "scorecards"


def card(name: str) -> dict:
    return json.loads((CARDS / f"{name}.json").read_text())


def line(result: dict, sample: str, metric: str) -> dict:
    [m] = [m for m in result["lines"] if m["sample"] == sample and m["metric"] == metric]
    return m


class OneEpochBaseline(unittest.TestCase):
    def setUp(self):
        self.result = compare(card("base-1-epoch"), card("fix-1-epoch"))

    def test_a_cost_change_under_ten_percent_is_noise(self):
        m = line(self.result, "01-single-docs", "dollars")
        self.assertEqual((m["baseline"], m["fix"]), (2.00, 2.10))
        self.assertAlmostEqual(m["diff"], 0.10)
        self.assertAlmostEqual(m["band"], 0.20)
        self.assertTrue(m["noise"])

    def test_a_time_change_over_ten_percent_is_not_noise(self):
        m = line(self.result, "01-single-docs", "wall_clock_s")
        self.assertEqual((m["baseline"], m["fix"], m["diff"]), (100.0, 130.0, 30.0))
        self.assertAlmostEqual(m["band"], 10.0)
        self.assertFalse(m["noise"])


class ThreeEpochBaseline(unittest.TestCase):
    def setUp(self):
        self.result = compare(card("base-3-epochs"), card("fix-3-epochs"))

    def test_the_band_is_the_baselines_measured_spread_not_ten_percent(self):
        # baseline dollars 1.00, 1.20, 1.10: spread 0.20, where 10% of the mean would be 0.11
        m = line(self.result, "01-single-docs", "dollars")
        self.assertAlmostEqual(m["band"], 0.20)
        self.assertEqual(m["band_source"], "spread")

    def test_a_change_inside_the_spread_is_noise(self):
        # fix dollars 1.15, 1.05, 1.10: mean 1.10 against 1.10
        m = line(self.result, "01-single-docs", "dollars")
        self.assertAlmostEqual(m["diff"], 0.0)
        self.assertTrue(m["noise"])

    def test_a_change_beyond_the_spread_is_not_noise(self):
        # baseline wall 100, 110, 90 (spread 20); fix 60, 65, 62
        m = line(self.result, "01-single-docs", "wall_clock_s")
        self.assertAlmostEqual(m["baseline"], 100.0)
        self.assertAlmostEqual(m["diff"], 62.333 - 100.0, places=2)
        self.assertAlmostEqual(m["band"], 20.0)
        self.assertFalse(m["noise"])

    def test_outcome_correctness_is_a_count_over_epochs(self):
        m = line(self.result, "01-single-docs", "outcome_correct")
        self.assertEqual((m["baseline"], m["baseline_epochs"], m["fix"], m["fix_epochs"], m["diff"]), (2, 3, 3, 3, 1))

    def test_false_passes_are_a_count_over_epochs(self):
        # baseline epoch 3 returned done while the hidden check failed
        m = line(self.result, "01-single-docs", "false_pass")
        self.assertEqual((m["baseline"], m["fix"], m["diff"]), (1, 0, -1))

    def test_a_recorded_false_pass_field_is_used_when_present(self):
        base = card("base-3-epochs")
        for r in base["rows"]:
            r["false_pass"] = False
        m = line(compare(base, card("fix-3-epochs")), "01-single-docs", "false_pass")
        self.assertEqual(m["baseline"], 0)


class Refusal(unittest.TestCase):
    def test_differing_engine_inspect_or_model_is_refused_with_the_reason(self):
        for field, value in [("engine_version", "@anthropic-ai/claude-agent-sdk 0.4.0"), ("inspect_version", "0.3.300"), ("model", "claude-sonnet-5")]:
            with self.subTest(field=field):
                fix = card("fix-1-epoch")
                fix["header"][field] = value
                with self.assertRaises(Mismatch) as e:
                    compare(card("base-1-epoch"), fix)
                self.assertIn(field, str(e.exception))
                self.assertIn(value, str(e.exception))
                self.assertIn("--force", str(e.exception))

    def test_force_compares_anyway_and_reports_the_difference(self):
        fix = card("fix-1-epoch")
        fix["header"]["model"] = "claude-sonnet-5"
        result = compare(card("base-1-epoch"), fix, force=True)
        self.assertEqual(len(result["mismatches"]), 1)
        self.assertTrue(result["lines"])


class Command(unittest.TestCase):
    def run_main(self, *args: str) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main([str(a) for a in args])
        return code, out.getvalue(), err.getvalue()

    def test_prints_both_values_the_difference_and_the_noise_verdict(self):
        code, out, _ = self.run_main(CARDS / "base-1-epoch.json", CARDS / "fix-1-epoch.json")
        self.assertEqual(code, 0)
        self.assertIn("| 01-single-docs | dollars | 2 | 2.1 | +0.1 | 0.2 (10%) | noise |", out)
        self.assertIn("| 01-single-docs | wall_clock_s | 100 | 130 | +30 | 10 (10%) | MOVED |", out)

    def test_prints_counts_as_counts_over_epochs(self):
        _, out, _ = self.run_main(CARDS / "base-3-epochs.json", CARDS / "fix-3-epochs.json")
        self.assertIn("| 01-single-docs | outcome_correct | 2/3 | 3/3 | +1 | count | changed |", out)
        self.assertIn("| 01-single-docs | false_pass | 1/3 | 0/3 | -1 | count | changed |", out)

    def test_refuses_with_a_clear_message_and_a_nonzero_exit(self):
        fix = card("fix-1-epoch")
        fix["header"]["inspect_version"] = "0.3.300"
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "fix.json"
            p.write_text(json.dumps(fix))
            code, out, err = self.run_main(CARDS / "base-1-epoch.json", p)
            self.assertEqual((code, out), (2, ""))
            self.assertIn("inspect_version: '0.3.292' vs '0.3.300'", err)
            code, out, _ = self.run_main(CARDS / "base-1-epoch.json", p, "--force")
            self.assertEqual(code, 0)
            self.assertIn("WARNING", out)


def _rows(sample: str, n: int, **kw) -> list[dict]:
    base = card("base-3-epochs")["rows"][0]
    return [{**base, "sample": sample, "epoch": e, **kw} for e in range(1, n + 1)]


class SamplesWithoutABaseline(unittest.TestCase):
    """A sample added or revised after the baseline was frozen is reported, never gated against a stale baseline."""

    def test_a_new_sample_is_reported_with_its_counts_and_not_compared(self):
        fix = card("fix-3-epochs")
        fix["rows"] += _rows("16-new", 3, outcome_correct=False, reported_status="done")
        result = compare(card("base-3-epochs"), fix)
        self.assertFalse([m for m in result["lines"] if m["sample"] == "16-new"])
        self.assertEqual(result["only_in_fix"], ["16-new"])
        self.assertEqual(result["no_baseline"], [{"sample": "16-new", "reason": "new", "epochs": 3,
                                                  "outcome_correct": 0, "false_pass": 3, "status_truthful": 3}])

    def test_revisions_default_to_1_for_every_sample_in_a_card_that_records_none(self):
        self.assertEqual(revisions(card("base-3-epochs")), {"01-single-docs": 1})

    def test_a_sample_revised_since_the_baseline_is_reported_with_its_counts_and_not_compared(self):
        fix = card("fix-3-epochs")
        fix["header"]["sample_revisions"] = {"01-single-docs": 2}
        result = compare(card("base-3-epochs"), fix)
        self.assertFalse(result["lines"])
        self.assertEqual(result["no_baseline"], [{"sample": "01-single-docs", "reason": "revised (baseline r1, fix r2)", "epochs": 3,
                                                  "outcome_correct": 3, "false_pass": 0, "status_truthful": 3}])

    def test_the_same_revision_on_both_sides_is_compared_as_before(self):
        base, fix = card("base-3-epochs"), card("fix-3-epochs")
        base["header"]["sample_revisions"] = fix["header"]["sample_revisions"] = {"01-single-docs": 2}
        result = compare(base, fix)
        self.assertEqual(result["no_baseline"], [])
        self.assertTrue(result["lines"])

    def test_the_command_says_which_samples_need_a_fresh_baseline(self):
        import tempfile
        fix = card("fix-3-epochs")
        fix["rows"] += _rows("16-new", 3)
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "fix.json"
            p.write_text(json.dumps(fix))
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = main([str(CARDS / "base-3-epochs.json"), str(p)])
        self.assertEqual(code, 0)
        self.assertIn("not gated (no baseline at this revision; freeze a fresh baseline epoch before gating on it)", out.getvalue())
        self.assertIn("| 16-new | new | 3/3 | 0/3 | 3/3 |", out.getvalue())

"""Ticket 11, unpaid parts: what freezing the baseline needs from the tooling.

- the scorecard records each sample's run-to-run spread;
- it records the run's actual cost and duration, against the routine budget, and the rule for cutting
  debate, best-of-n and relay to 1 epoch when a run is over it;
- run.py --baseline: every sample, every role on the pinned model, 5 epochs, written to baselines/ under the
  plugin commit, refused when the plugin source is dirty or changes during the run;
- a committed baseline is checked: full header, and no plugin source changed between its plugin commit and the
  commit that added it;
- the README states the reproduce and compare commands and the findings the suite cannot measure.

No model call, no Inspect needed.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import run
import scoring
import suite
from tests.test_run_parameters import fake_log, fake_sample


def row(sample: str, epoch: int, **kw) -> dict:
    base = {
        "sample": sample, "epoch": epoch, "outcome_correct": True, "status_truthful": True, "false_pass": False,
        "limit_hit": None, "reported_status": "done", "expected_status": "done", "dollars": 1.0, "wall_clock_s": 100.0,
        "queue_s": 0.0, "input_tokens": 10, "output_tokens": 5, "cache_read_tokens": 0, "cache_write_tokens": 0,
        "cache_write_share": 0.0, "agents": 2,
    }
    return {**base, **kw}


HEADER = {
    "plugin_commit": "abc123", "engine_version": suite.ENGINE_VERSION, "inspect_version": suite.INSPECT_VERSION,
    "model": suite.MODEL, "concurrency_cap": 2, "cpus": 4, "memory": "8g", "epochs": 3,
}


class Spread(unittest.TestCase):
    def test_the_scorecard_records_each_sample_s_spread_over_its_epochs(self):
        rows = [
            row("01-single-docs", 1, dollars=1.0, wall_clock_s=100.0),
            row("01-single-docs", 2, dollars=1.5, wall_clock_s=130.0, outcome_correct=False, false_pass=True),
            row("01-single-docs", 3, dollars=1.2, wall_clock_s=90.0),
            row("15-fan-out-over-budget", 1, dollars=0.0, agents=0),
        ]
        sp = scoring.scorecard(HEADER, rows)["spread"]
        d = sp["01-single-docs"]
        self.assertEqual(d["epochs"], 3)
        self.assertEqual(d["dollars"], {"min": 1.0, "max": 1.5, "spread": 0.5, "n": 3})
        self.assertEqual(d["wall_clock_s"], {"min": 90.0, "max": 130.0, "spread": 40.0, "n": 3})
        self.assertEqual((d["outcome_correct"], d["false_pass"], d["status_truthful"]), ("2/3", "1/3", "3/3"))
        self.assertEqual(sp["15-fan-out-over-budget"]["agents"], {"min": 0, "max": 0, "spread": 0, "n": 1})

    def test_a_limit_hit_epoch_counts_in_no_score_and_a_missing_value_in_no_spread(self):
        rows = [row("01-single-docs", 1, dollars=None), row("01-single-docs", 2, limit_hit="cost", outcome_correct=None, false_pass=None)]
        d = scoring.scorecard(HEADER, rows)["spread"]["01-single-docs"]
        self.assertEqual(d["dollars"]["n"], 1)
        self.assertEqual(d["outcome_correct"], "1/1")
        self.assertEqual(d["limit_hits"], 1)

    def test_the_markdown_scorecard_has_a_spread_table(self):
        md = scoring.render_markdown(scoring.scorecard(HEADER, [row("01-single-docs", 1, dollars=1.0), row("01-single-docs", 2, dollars=1.25)]))
        self.assertIn("Run-to-run spread", md)
        self.assertIn("| 01-single-docs | 2 | 2/2 | 2/2 | 0/2 | 1.0000-1.2500 (0.2500) |", md)


class RunCost(unittest.TestCase):
    def test_the_scorecard_records_the_run_s_total_dollars_and_duration_against_the_budget(self):
        card = scoring.scorecard(HEADER, [row("01-single-docs", 1, dollars=12.0), row("02-single-blocked", 1, dollars=9.5)], duration_s=1234.5)
        self.assertEqual(card["run_cost"], {"dollars": 21.5, "duration_s": 1234.5, "budget": 30.0, "over_budget": False, "cut_to_one_epoch": []})

    def test_a_run_over_the_budget_names_debate_best_of_n_and_relay_to_cut_to_one_epoch(self):
        card = scoring.scorecard(HEADER, [row("01-single-docs", 1, dollars=31.0)], duration_s=60.0)
        rc = card["run_cost"]
        self.assertTrue(rc["over_budget"])
        self.assertEqual(rc["cut_to_one_epoch"], ["12-best-of-n-python-bug", "13-debate-design", "14-relay-python-features"])
        self.assertIn("over the $30.00 routine budget", scoring.render_markdown(card))

    def test_an_unpriced_row_leaves_the_total_unknown_and_cuts_nothing(self):
        rc = scoring.scorecard(HEADER, [row("01-single-docs", 1, dollars=None)])["run_cost"]
        self.assertEqual((rc["dollars"], rc["over_budget"], rc["cut_to_one_epoch"]), (None, None, []))

    def test_the_cut_samples_are_the_debate_best_of_n_and_relay_samples(self):
        topo = {s["id"]: s["args"]["dispatch"]["topology"] for s in suite.load_samples()}
        self.assertEqual(sorted(topo[s] for s in suite.CUT_TO_ONE_EPOCH), ["best-of-n", "debate", "relay"])

    def test_run_py_records_the_log_s_duration(self):
        log = fake_log({}, [fake_sample()])
        log.stats = SimpleNamespace(started_at="2026-11-26T10:00:00+00:00", completed_at="2026-11-26T10:20:30+00:00")
        self.assertEqual(run.build_scorecard(log, "abc123")["run_cost"]["duration_s"], 1230.0)


class OneEpochCut(unittest.TestCase):
    def test_the_cut_samples_run_at_one_epoch_and_the_rest_at_the_run_s_epochs(self):
        a = run.build_parser().parse_args(["--cut-to-one-epoch"])
        plan = run.epoch_plan(a)
        ids = [s["id"] for s in suite.load_samples()]
        self.assertEqual(plan, [(3, [i for i in ids if i not in suite.CUT_TO_ONE_EPOCH]), (1, list(suite.CUT_TO_ONE_EPOCH))])

    def test_without_the_cut_every_sample_runs_at_the_run_s_epochs(self):
        self.assertEqual(run.epoch_plan(run.build_parser().parse_args(["--samples", "01-single-docs"])), [(3, ["01-single-docs"])])

    def test_a_scorecard_merged_from_two_logs_records_the_epochs_per_sample(self):
        s1 = fake_sample()
        s2 = fake_sample()
        s2.id = "13-debate-design"
        l1, l2 = fake_log({"epochs": 3}, [s1]), fake_log({"epochs": 1}, [s2])
        l1.eval.config.epochs, l2.eval.config.epochs = 3, 1
        card = run.build_scorecard([l1, l2], "abc123")
        self.assertEqual(card["header"]["epochs"], 3)
        self.assertEqual(card["header"]["epochs_by_sample"], {"13-debate-design": 1})
        self.assertEqual([r["sample"] for r in card["rows"]], ["01-single-docs", "13-debate-design"])


class BaselineCommand(unittest.TestCase):
    def test_the_baseline_runs_every_sample_at_five_epochs_on_the_pinned_model(self):
        a = run.build_parser().parse_args(["--baseline"])
        self.assertEqual(run.resolve_baseline(a), None)
        self.assertEqual((a.epochs, a.samples, a.role_model, a.stub, a.out_dir), (5, "", [], False, str(suite.BASELINES)))

    def test_the_baseline_refuses_anything_that_is_not_the_untouched_plugin_on_every_sample(self):
        for extra in (["--stub"], ["--role-model", "evaluator=claude-haiku-5-5"], ["--samples", "01-single-docs"], ["--epochs", "3"], ["--cut-to-one-epoch"]):
            a = run.build_parser().parse_args(["--baseline", *extra])
            self.assertIsNotNone(run.resolve_baseline(a), extra)

    def test_a_dirty_plugin_cannot_be_frozen(self):
        self.assertIn("uncommitted", run.baseline_refusal("abc123-dirty", "abc123-dirty"))

    def test_a_plugin_that_changed_during_the_run_cannot_be_frozen(self):
        self.assertIn("changed during the run", run.baseline_refusal("abc123", "def456"))
        self.assertIsNone(run.baseline_refusal("abc123", "abc123"))

    def test_the_baseline_is_written_under_its_plugin_commit_and_never_overwritten(self):
        card = scoring.scorecard({**HEADER, "epochs": 5}, [row("01-single-docs", 1)])
        with tempfile.TemporaryDirectory() as d:
            j, m = run.write_baseline(card, Path(d))
            self.assertEqual((j.name, m.name), ("abc123.json", "abc123.md"))
            self.assertEqual(json.loads(j.read_text())["header"]["plugin_commit"], "abc123")
            with self.assertRaises(FileExistsError):
                run.write_baseline(card, Path(d))

    def test_the_header_carries_every_pin(self):
        h = run.build_scorecard(fake_log({}, [fake_sample()]), "abc123")["header"]
        self.assertEqual((h["sdk_version"], h["claude_code_version"], h["pytest_version"]), (suite.SDK_VERSION, suite.CLAUDE_CODE_VERSION, suite.PYTEST_VERSION))


def full_baseline(commit: str = "abc123") -> dict:
    rows = [row(s["id"], e) for s in suite.load_samples() for e in range(1, 6)]
    header = {**HEADER, "plugin_commit": commit, "epochs": 5, "stub": False, "role_models": {}, "cost_limit": 30.0, "time_limit": 1800,
              "sdk_version": suite.SDK_VERSION, "claude_code_version": suite.CLAUDE_CODE_VERSION, "pytest_version": suite.PYTEST_VERSION,
              "created_at": "x", "log": "x.eval", "sample_revisions": {s["id"]: suite.sample_revision(s) for s in suite.load_samples()}}
    return scoring.scorecard(header, rows)


class BaselineCheck(unittest.TestCase):
    def test_a_full_baseline_passes(self):
        self.assertEqual(run.baseline_problems(full_baseline(), "abc123.json"), [])

    def test_a_baseline_that_is_not_the_frozen_configuration_is_named(self):
        card = full_baseline()
        card["header"].update(epochs=3, stub=True, role_models={"evaluator": "claude-haiku-5-5"}, model="claude-sonnet-5-5")
        del card["header"]["pytest_version"]
        card["rows"] = [r for r in card["rows"] if r["sample"] != "13-debate-design"]
        problems = "\n".join(run.baseline_problems(card, "other.json"))
        for word in ("epochs", "stub", "role_models", "model", "pytest_version", "13-debate-design", "file name", "spread"):
            self.assertIn(word, problems)

    def test_a_baseline_that_records_every_current_revision_but_lacks_a_sample_s_rows_is_incomplete(self):
        card = full_baseline()
        card["rows"] = [r for r in card["rows"] if r["sample"] != "16-generator-evaluator-countable-criteria"]
        card["spread"].pop("16-generator-evaluator-countable-criteria")
        self.assertIn("16-generator-evaluator-countable-criteria", "\n".join(run.baseline_problems(card, "abc123.json")))

    def test_a_sample_added_or_revised_after_a_baseline_is_stale_there_not_a_problem(self):
        card = full_baseline()
        card["header"]["sample_revisions"]["10-iterative-fan-out-docs-gap"] = 1
        del card["header"]["sample_revisions"]["16-generator-evaluator-countable-criteria"]
        card["rows"] = [r for r in card["rows"] if r["sample"] != "16-generator-evaluator-countable-criteria"]
        card["spread"].pop("16-generator-evaluator-countable-criteria")
        self.assertEqual(run.baseline_problems(card, "abc123.json"), [])
        self.assertEqual(run.stale_samples(card), ["10-iterative-fan-out-docs-gap", "16-generator-evaluator-countable-criteria"])

    def test_the_frozen_baseline_predates_sample_10_s_fix_and_sample_16(self):
        card = json.loads((suite.BASELINES / "3035a58f6828.json").read_text())
        self.assertEqual(run.stale_samples(card), ["10-iterative-fan-out-docs-gap", "16-generator-evaluator-countable-criteria"])

    def test_the_scorecard_header_records_each_sample_s_revision_from_the_log(self):
        s1, s2 = fake_sample(), fake_sample()
        s2.id, s2.metadata = "10-iterative-fan-out-docs-gap", {**s2.metadata, "revision": 2}
        h = run.build_scorecard(fake_log({}, [s1, s2]), "abc123")["header"]
        self.assertEqual(h["sample_revisions"], {"01-single-docs": 1, "10-iterative-fan-out-docs-gap": 2})

    def test_sample_10_is_at_revision_2_and_the_rest_at_1(self):
        revs = {s["id"]: suite.sample_revision(s) for s in suite.load_samples()}
        self.assertEqual({k: v for k, v in revs.items() if v != 1}, {"10-iterative-fan-out-docs-gap": 2})

    def test_plugin_source_is_everything_in_the_plugin_and_skills_but_the_evals(self):
        spec = run.plugin_source_pathspec()
        self.assertIn("graph-orchestrator", spec)
        self.assertIn("skills", spec)
        self.assertIn(":(exclude)graph-orchestrator/evals", spec)

    def test_every_committed_baseline_is_complete_and_its_plugin_source_unchanged_since_its_commit(self):
        for f in sorted(suite.BASELINES.glob("*.json")):
            card = json.loads(f.read_text())
            self.assertEqual(run.baseline_problems(card, f.name), [], f.name)
            added = subprocess.run(
                ["git", "-C", str(suite.REPO), "log", "--diff-filter=A", "--format=%H", "-1", "--", str(f)], capture_output=True, text=True
            ).stdout.strip() or "HEAD"
            self.assertEqual(run.plugin_source_changes(card["header"]["plugin_commit"], added), [], f.name)


class Readme(unittest.TestCase):
    readme = (suite.EVALS / "README.md").read_text()

    def test_the_readme_states_the_reproduce_and_compare_commands(self):
        self.assertIn("run.py --baseline", self.readme)
        self.assertIn("compare.py graph-orchestrator/evals/baselines/<plugin commit>.json", self.readme)

    def test_the_readme_lists_each_finding_the_suite_cannot_measure_and_how_it_is_checked_by_hand(self):
        section = self.readme[self.readme.index("## Not measured by the suite"):]
        for finding in ("REL-01", "REL-03", "REL-05", "REL-07", "REL-08", "QUA-05"):
            self.assertIn(f"| {finding} ", section, finding)

    def test_the_readme_says_what_the_budget_rule_did(self):
        self.assertIn("--cut-to-one-epoch", self.readme)


if __name__ == "__main__":
    unittest.main()

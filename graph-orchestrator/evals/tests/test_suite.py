"""The suite's pins agree with what is installed, and the hidden check stays out of the sandbox copy."""

from __future__ import annotations

import json
import re
import unittest

import suite


class Pins(unittest.TestCase):
    def test_inspect_is_pinned_in_requirements(self):
        req = (suite.EVALS / "requirements.txt").read_text()
        self.assertIn(f"inspect_ai=={suite.INSPECT_VERSION}\n", req)

    def test_the_engine_is_pinned_in_the_sandbox_image(self):
        pkg = json.loads((suite.EVALS / "sandbox" / "package.json").read_text())
        self.assertEqual(pkg["dependencies"]["@anthropic-ai/claude-agent-sdk"], suite.SDK_VERSION)

    def test_pytest_is_pinned_in_the_sandbox_image(self):
        self.assertIn(f"pytest=={suite.PYTEST_VERSION}\n", (suite.EVALS / "sandbox" / "requirements.txt").read_text())

    def test_the_model_is_pinned_declared_and_priced(self):
        self.assertEqual(suite.MODEL, "claude-opus-5-5")
        self.assertIn(suite.MODEL, suite.DECLARED_MODELS)
        self.assertEqual(set(suite.PRICES), set(suite.DECLARED_MODELS))

    def test_sample_1_runs_every_role_on_the_main_model(self):
        (s1,) = [s for s in suite.load_samples() if s["id"] == "01-single-docs"]
        text = json.dumps(s1)
        self.assertIsNone(re.search(r'"model"\s*:', text), "a sample that requests a model would leave the pinned one")


class HiddenCheckStaysOut(unittest.TestCase):
    def test_only_the_fixture_sandbox_tree_is_copied(self):
        copied = suite.fixture_sandbox_files("docs")
        self.assertEqual(sorted(copied), ["/work/docs/glossary.md", "/work/docs/ledger-service.md", "/work/docs/retry-policy.md"])

    def test_no_hidden_file_is_among_the_copied_files(self):
        hidden = {p.name for p in suite.hidden_files("docs")}
        self.assertEqual(hidden, {"planted_facts.json"})
        self.assertFalse(hidden & {p.name for p in suite.fixture_sandbox_files("docs").values()})


if __name__ == "__main__":
    unittest.main()


class Samples(unittest.TestCase):
    def by_id(self):
        return {s["id"]: s for s in suite.load_samples()}

    def test_the_single_and_fan_out_samples_exist_with_their_topology_and_expected_status(self):
        got = {i: (s["args"]["dispatch"]["topology"], s["expected_status"]) for i, s in self.by_id().items()}
        for i, want in {
            "02-single-blocked": ("single", "blocked"),
            "06-fan-out-reducer-docs": ("fan-out", "done"),
            "07-fan-out-partition-docs": ("fan-out", "done"),
            "15-fan-out-over-budget": ("fan-out", "over_budget"),
        }.items():
            self.assertEqual(got[i], want, i)

    def test_sample_15_splits_past_the_width_cap_and_sample_7_partitions_six_ways(self):
        s = self.by_id()
        self.assertEqual(len(s["15-fan-out-over-budget"]["args"]["dispatch"]["params"]["split"]), 10)
        p7 = s["07-fan-out-partition-docs"]["args"]["dispatch"]["params"]
        self.assertIsInstance(p7["split"], str)
        self.assertEqual(p7["width"], 6)
        p6 = s["06-fan-out-reducer-docs"]["args"]["dispatch"]
        self.assertIsInstance(p6["params"]["split"], list)
        self.assertIn("reducer", p6["roles"])

    def test_no_sample_requests_a_model(self):
        for s in suite.load_samples():
            self.assertIsNone(re.search(r'"model"\s*:', json.dumps(s)), s["id"])


class HiddenChecks(unittest.TestCase):
    def sample(self, sid):
        (s,) = [s for s in suite.load_samples() if s["id"] == sid]
        return s

    def test_a_research_sample_is_checked_by_the_fixture_planted_facts(self):
        c = suite.hidden_check(self.sample("01-single-docs"))
        self.assertEqual((c["kind"], c["source"], len(c["facts"])), ("facts", "result+files", 6))

    def test_sample_6_scores_the_returned_result_only(self):
        c = suite.hidden_check(self.sample("06-fan-out-reducer-docs"))
        self.assertEqual((c["kind"], c["source"], len(c["facts"])), ("facts", "result", 6))

    def test_sample_2_must_block_with_a_question_and_leave_the_config_as_it_was(self):
        c = suite.hidden_check(self.sample("02-single-blocked"))
        self.assertEqual(c["kind"], "blocked")
        self.assertTrue(c["question_patterns"])
        self.assertEqual(list(c["unchanged"]), ["/work/config/settlement.toml"])
        self.assertIn('cut_off_utc = ""', c["unchanged"]["/work/config/settlement.toml"])

    def test_sample_15_is_checked_for_over_budget(self):
        self.assertEqual(suite.hidden_check(self.sample("15-fan-out-over-budget"))["kind"], "over_budget")

    def test_the_blocked_fixture_keeps_its_check_out_of_the_sandbox(self):
        self.assertEqual(sorted(suite.fixture_sandbox_files("blocked")), ["/work/config/settlement.toml", "/work/docs/CR-212.md"])
        self.assertEqual({p.name for p in suite.hidden_files("blocked")}, {"expected_block.json"})


def _specs(spec: dict):
    """A dispatch spec and, for a chain, each of its stages (recursively)."""
    yield spec
    for st in (spec.get("params") or {}).get("stages") or []:
        yield from _specs(st)


class PythonSamples(unittest.TestCase):
    def by_id(self):
        return {s["id"]: s for s in suite.load_samples()}

    def test_samples_3_5_8_9_exist_on_the_python_fixture_with_their_topology_and_expected_status(self):
        got = {i: (s["fixture"], s["args"]["dispatch"]["topology"], s["expected_status"]) for i, s in self.by_id().items()}
        self.assertEqual(got["03-generator-evaluator-python"], ("python", "generator-evaluator", "done"))
        self.assertEqual(got["05-generator-evaluator-exhausted"], ("python", "generator-evaluator", "exhausted"))
        self.assertEqual(got["08-chain-single-then-ge-python"], ("python", "chain", "done"))
        self.assertEqual(got["09-chain-stage-2-fails"], ("python", "chain", "exhausted"))

    def test_generator_roles_name_test_driven_development_and_evaluator_roles_name_code_review(self):
        seen = set()
        for s in suite.load_samples():
            for spec in _specs(s["args"]["dispatch"]):
                for role, entry in spec.get("roles", {}).items():
                    if role == "generator":
                        self.assertEqual(entry.get("skill"), "test-driven-development", f"{s['id']} {spec.get('id', '')}")
                    if role == "evaluator":
                        self.assertEqual(entry.get("skill"), "code-review", f"{s['id']} {spec.get('id', '')}")
                    seen.add(role)
        self.assertLessEqual({"generator", "evaluator"}, seen)

    def test_both_named_skills_are_in_this_repo_skills_plugin_which_the_solver_installs_in_the_sandbox(self):
        for name in ("test-driven-development", "code-review"):
            self.assertTrue((suite.SKILLS / "skills" / name / "SKILL.md").is_file(), name)
        self.assertTrue((suite.SKILLS / ".claude-plugin" / "plugin.json").is_file())

    def test_sample_5_allows_2_rounds_and_sample_9_has_a_second_stage_that_cannot_pass(self):
        s = self.by_id()
        self.assertEqual(s["05-generator-evaluator-exhausted"]["args"]["dispatch"]["params"]["max_iterations"], 2)
        stages = s["09-chain-stage-2-fails"]["args"]["dispatch"]["params"]["stages"]
        self.assertEqual([st["topology"] for st in stages], ["single", "generator-evaluator", "single"])
        self.assertEqual(stages[1]["params"]["max_iterations"], 1)
        s8 = s["08-chain-single-then-ge-python"]["args"]["dispatch"]["params"]["stages"]
        self.assertEqual([st["topology"] for st in s8], ["single", "generator-evaluator"])

    def test_samples_3_and_8_are_scored_by_the_hidden_tests(self):
        s = self.by_id()
        for sid in ("03-generator-evaluator-python", "08-chain-single-then-ge-python"):
            c = suite.hidden_check(s[sid])
            self.assertEqual((c["kind"], c["tests"]), ("tests", ["test_duration_strict.py"]), sid)

    def test_sample_5_is_checked_for_exhausted_after_2_rounds_and_sample_9_for_the_stage_it_stopped_at(self):
        s = self.by_id()
        self.assertEqual(suite.hidden_check(s["05-generator-evaluator-exhausted"]), {"kind": "exhausted", "rounds": 2})
        self.assertEqual(suite.hidden_check(s["09-chain-stage-2-fails"]), {"kind": "chain_stop", "stage": 2, "status": "exhausted", "stages": 3})

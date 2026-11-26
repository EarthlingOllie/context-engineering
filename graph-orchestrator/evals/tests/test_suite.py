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

    def test_the_roles_a_model_can_be_forced_on_are_the_plugin_label_roles(self):
        labels = (suite.PLUGIN / "src" / "labels.ts").read_text()
        roles = re.search(r"export type LabelRole = ([^;]+);", labels).group(1)
        self.assertEqual(sorted(suite.ROLES), sorted(re.findall(r'"([a-z]+)"', roles)))

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


class TypeScriptSamples(unittest.TestCase):
    def by_id(self):
        return {s["id"]: s for s in suite.load_samples()}

    def test_samples_4_and_11_exist_on_the_typescript_fixture_with_their_topology_and_expected_status(self):
        got = {i: (s["fixture"], s["args"]["dispatch"]["topology"], s["expected_status"]) for i, s in self.by_id().items()}
        self.assertEqual(got["04-generator-evaluator-false-pass"], ("typescript", "generator-evaluator", "done"))
        self.assertEqual(got["11-panel-diff-defect"], ("typescript", "panel", "done"))

    def test_sample_4_has_vague_pass_criteria_and_is_scored_by_the_hidden_test(self):
        s4 = self.by_id()["04-generator-evaluator-false-pass"]
        self.assertEqual(s4["args"]["dispatch"]["params"]["pass_criteria"], "The relevant tests pass.")
        self.assertEqual(suite.hidden_check(s4), {"kind": "tests", "runner": "node", "tests": ["paginate.hidden.test.ts"]})

    def test_sample_11_reviews_the_diff_through_lenses_including_the_defects_and_must_fail_naming_it(self):
        s11 = self.by_id()["11-panel-diff-defect"]
        d = s11["args"]["dispatch"]
        self.assertIn("/work/review/0001-log-page-requests.diff", d["task"])
        self.assertIn("/work/review/0001-log-page-requests.diff", suite.fixture_sandbox_files("typescript"))
        lenses = [l["name"] for l in d["params"]["lenses"]]
        check = suite.hidden_check(s11)
        self.assertEqual({k: check[k] for k in ("kind", "verdict", "lens")}, {"kind": "verdict", "verdict": "FAIL", "lens": "security"})
        self.assertIn(check["lens"], lenses)
        self.assertNotIn("reducer", d["params"])
        self.assertGreaterEqual(d["returns"]["maxLines"], 1 + len(lenses), "room for the verdict line and one line per failing lens")
        self.assertNotIn("token", json.dumps(d).lower(), "the sample must not point the reviewers at the defect")


class RemainingTopologySamples(unittest.TestCase):
    """Ticket 08: samples 10, 12, 13 and 14, so every topology in the catalog has a sample."""

    def by_id(self):
        return {s["id"]: s for s in suite.load_samples()}

    def test_every_topology_in_the_catalog_has_a_sample(self):
        catalog = (suite.PLUGIN / "skills" / "graph-orchestrator" / "catalog.md").read_text()
        topologies = set(re.findall(r"^## ([a-z-]+)$", catalog, re.MULTILINE))
        self.assertEqual(len(topologies), 9)
        covered = {spec["topology"] for s in suite.load_samples() for spec in _specs(s["args"]["dispatch"])}
        self.assertLessEqual(topologies, covered)

    def test_the_suite_has_15_samples_numbered_1_to_15(self):
        self.assertEqual([int(s["id"][:2]) for s in suite.load_samples()], list(range(1, 16)))

    def test_samples_10_12_13_14_with_their_topology_fixture_and_expected_status(self):
        got = {i: (s["fixture"], s["args"]["dispatch"]["topology"], s["expected_status"]) for i, s in self.by_id().items()}
        self.assertEqual(got["10-iterative-fan-out-docs-gap"], ("docs-gap", "iterative-fan-out", "done"))
        self.assertEqual(got["12-best-of-n-python-bug"], ("python-bug", "best-of-n", "done"))
        self.assertEqual(got["13-debate-design"], ("design", "debate", "done"))
        self.assertEqual(got["14-relay-python-features"], ("python", "relay", "done"))

    def test_sample_10_covers_only_the_top_level_docs_in_round_1_so_the_runbook_shows_only_in_round_2(self):
        s10 = self.by_id()["10-iterative-fan-out-docs-gap"]
        d = s10["args"]["dispatch"]
        files = sorted(suite.fixture_sandbox_files("docs-gap"))
        self.assertIn("/work/docs/runbooks/payout-failures.md", files)
        split = " ".join(d["params"]["split"])
        self.assertNotIn("runbooks", split)
        self.assertNotIn("payout-failures", json.dumps(d))
        self.assertEqual(d["params"]["max_rounds"], 2)
        c = suite.hidden_check(s10)
        self.assertEqual((c["kind"], c["rounds"], len(c["facts"])), ("coverage", 2, 6))
        self.assertTrue(any(f["file"] == "payout-failures.md" for f in c["facts"]))

    def test_sample_12_runs_3_variants_and_is_scored_by_the_hidden_tests_on_the_chosen_candidate(self):
        d = self.by_id()["12-best-of-n-python-bug"]["args"]["dispatch"]
        self.assertEqual(len(d["params"]["variants"]), 3)
        self.assertIn("judge", d["roles"])
        c = suite.hidden_check(self.by_id()["12-best-of-n-python-bug"])
        self.assertEqual((c["kind"], c["tests"]), ("chosen_tests", ["test_allocate_strict.py"]))

    def test_sample_13_returns_one_of_the_options_and_its_demand_is_participants_times_rounds_plus_the_judge(self):
        s13 = self.by_id()["13-debate-design"]
        d = s13["args"]["dispatch"]
        self.assertIn("judge", d["roles"])
        c = suite.hidden_check(s13)
        self.assertEqual(c["kind"], "contract_verdict")
        self.assertEqual(sorted(c["options"]), sorted(p["name"] for p in d["params"]["participants"]))
        self.assertEqual(c["max_lines"], d["returns"]["maxLines"])
        self.assertEqual(suite.catalog_demand(d), len(d["params"]["participants"]) * d["params"]["rounds"] + 1)

    def test_sample_14_relays_over_3_sessions_watching_its_progress_file_and_is_scored_by_the_hidden_tests(self):
        s14 = self.by_id()["14-relay-python-features"]
        p = s14["args"]["dispatch"]["params"]
        self.assertEqual(p["max_sessions"], 3)
        c = suite.hidden_check(s14)
        self.assertEqual((c["kind"], c["sessions"], c["progress"], c["tests"]), ("relay", 3, p["progress"], ["test_duration_strict.py"]))
        self.assertEqual(c["watch"], [p["progress"]])

    def test_the_new_fixtures_keep_their_checks_out_of_the_sandbox(self):
        for fixture in ("docs-gap", "python-bug", "design"):
            hidden = {p.name for p in suite.hidden_files(fixture)}
            self.assertTrue(hidden, fixture)
            self.assertFalse(hidden & {p.name for p in suite.fixture_sandbox_files(fixture).values()}, fixture)


class CatalogDemand(unittest.TestCase):
    """The catalog's demand formula per topology (skills/graph-orchestrator/catalog.md), with the catalog's defaults."""

    def test_each_topology_against_the_catalog(self):
        d = suite.catalog_demand
        self.assertEqual(d({"topology": "single"}), 1)
        self.assertEqual(d({"topology": "generator-evaluator", "params": {"max_iterations": 3}}), 6)
        self.assertEqual(d({"topology": "fan-out", "params": {"split": ["a", "b", "c"], "reducer": True}}), 4)
        self.assertEqual(d({"topology": "fan-out", "params": {"split": "partition it", "width": 6}}), 7)
        self.assertEqual(d({"topology": "relay", "params": {}}), 6)
        self.assertEqual(d({"topology": "relay", "params": {"max_sessions": 6, "check_every": 2}}), 9)
        self.assertEqual(d({"topology": "best-of-n", "params": {"variants": ["a", "b", "c"]}}), 4)
        self.assertEqual(d({"topology": "iterative-fan-out", "params": {"split": [str(i) for i in range(6)], "max_rounds": 2}}), 15)
        self.assertEqual(d({"topology": "iterative-fan-out", "params": {"split": "by dir", "width": 6, "max_rounds": 2}}), 16)
        self.assertEqual(d({"topology": "panel", "params": {"lenses": [{}, {}, {}]}}), 3)
        self.assertEqual(d({"topology": "panel", "params": {"lenses": [{}, {}], "reducer": True}}), 3)
        self.assertEqual(d({"topology": "debate", "params": {"participants": [{}, {}], "rounds": 2}}), 5)
        self.assertEqual(d({"topology": "chain", "params": {"stages": [{"topology": "single"}, {"topology": "generator-evaluator", "params": {"max_iterations": 3}}]}}), 7)

    def test_a_spec_past_a_cap_demands_nothing(self):
        self.assertEqual(suite.catalog_demand({"topology": "fan-out", "params": {"split": [str(i) for i in range(10)]}}), 0)


class ReadmeSamples(unittest.TestCase):
    def test_the_readme_lists_every_sample_with_its_topology_fixture_expected_status_and_target(self):
        readme = (suite.EVALS / "README.md").read_text()
        header = "| Sample | Topology | Fixture | Expected | Target | Hidden check |"
        self.assertIn(header, readme)
        rows = {}
        for line in readme[readme.index(header):].splitlines()[2:]:
            if not line.startswith("| `"):
                break
            cells = [c.strip() for c in line.strip("|").split("|")]
            rows[cells[0].strip("`")] = cells
        samples = suite.load_samples()
        self.assertEqual(sorted(rows), [s["id"] for s in samples])
        for s in samples:
            sid, topology, fixture, expected, target, _check = rows[s["id"]]
            norm = lambda t: t.lower().replace("-", " ")  # noqa: E731
            self.assertTrue(norm(topology).startswith(norm(s["args"]["dispatch"]["topology"])), sid)
            self.assertEqual((fixture, expected), (s["fixture"], s["expected_status"]), sid)
            self.assertTrue(target, sid)

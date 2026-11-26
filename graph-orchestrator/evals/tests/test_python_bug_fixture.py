"""The python-bug fixture is fit for sample 12 (best-of-n): its visible tests
miss the planted bug, its hidden tests catch it, a fix passes both, and the
hidden tests are run on the fixture with the chosen candidate's copy laid over
it (suite.chosen_candidate_tree), not on the working tree.

Skipped where pytest is not installed.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import suite

FIXTURE = suite.FIXTURES / "python-bug"
FIXED = (FIXTURE / "reference" / "fixed" / "feekit" / "allocate.py").read_text()
SHIPPED = (FIXTURE / "sandbox" / "feekit" / "allocate.py").read_text()

try:
    import pytest  # noqa: F401

    HAVE_PYTEST = True
except ImportError:
    HAVE_PYTEST = False


def run_pytest(tree: dict[str, object], *, hidden: bool) -> int:
    """Exit code of pytest over a tree (relative path -> host file or text), with the hidden tests if asked."""
    with tempfile.TemporaryDirectory() as d:
        work = Path(d)
        for rel, src in tree.items():
            p = work / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(src.read_bytes() if isinstance(src, Path) else str(src).encode())
        args = ["tests"]
        if hidden:
            (work / "hidden_check").mkdir()
            for f in suite.hidden_test_files("python-bug"):
                (work / "hidden_check" / f.name).write_text(f.read_text())
            args = ["hidden_check"]
        return subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *args], cwd=work, capture_output=True, text=True).returncode


CANDIDATES = {
    "/work/scratch/w1-d12-c1/feekit/allocate.py": SHIPPED.replace("round(", "int("),
    "/work/scratch/w1-d12-c2/feekit/allocate.py": FIXED,
    "/work/scratch/w1-d12-c2/NOTES.md": "integer floors, then the left-over cents",
    "/work/scratch/trace/w1-d12.jsonl": "{}",
}


@unittest.skipUnless(HAVE_PYTEST, "pytest is not installed")
class PythonBugFixture(unittest.TestCase):
    def test_as_shipped_the_visible_tests_pass_and_the_hidden_tests_fail(self):
        tree = suite.chosen_candidate_tree("python-bug", {}, "/work/scratch/none")
        self.assertEqual(run_pytest(tree, hidden=False), 0)
        self.assertEqual(run_pytest(tree, hidden=True), 1)

    def test_the_chosen_fixed_candidate_passes_visible_and_hidden_tests(self):
        tree = suite.chosen_candidate_tree("python-bug", CANDIDATES, "/work/scratch/w1-d12-c2")
        self.assertEqual(run_pytest(tree, hidden=False), 0)
        self.assertEqual(run_pytest(tree, hidden=True), 0)

    def test_a_chosen_candidate_that_only_changes_the_rounding_fails_the_hidden_tests(self):
        tree = suite.chosen_candidate_tree("python-bug", CANDIDATES, "/work/scratch/w1-d12-c1")
        self.assertEqual(run_pytest(tree, hidden=True), 1)


class ChosenCandidateTree(unittest.TestCase):
    def test_the_fixture_as_shipped_with_only_the_chosen_candidates_files_laid_over_it(self):
        tree = suite.chosen_candidate_tree("python-bug", CANDIDATES, "/work/scratch/w1-d12-c2")
        self.assertEqual(tree["feekit/allocate.py"], FIXED)
        self.assertEqual(tree["NOTES.md"], "integer floors, then the left-over cents")
        self.assertEqual(tree["tests/test_allocate.py"], FIXTURE / "sandbox" / "tests" / "test_allocate.py")
        self.assertNotIn("scratch/trace/w1-d12.jsonl", tree)
        self.assertEqual(sorted(k for k in tree if k.startswith("feekit/")), ["feekit/__init__.py", "feekit/allocate.py"])


class PythonBugFixtureLayout(unittest.TestCase):
    def test_the_sandbox_has_the_package_visible_tests_and_the_bug_report_but_no_hidden_test_or_reference(self):
        copied = suite.fixture_sandbox_files("python-bug")
        self.assertEqual(
            sorted(copied),
            ["/work/docs/BUG-431.md", "/work/feekit/__init__.py", "/work/feekit/allocate.py", "/work/pyproject.toml", "/work/tests/test_allocate.py"],
        )

    def test_the_hidden_check_names_its_test_files(self):
        self.assertEqual([p.name for p in suite.hidden_test_files("python-bug")], ["test_allocate_strict.py"])
        self.assertEqual({p.name for p in suite.hidden_files("python-bug")}, {"check.json", "test_allocate_strict.py"})


if __name__ == "__main__":
    unittest.main()

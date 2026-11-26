"""The Python fixture is fit for samples 3, 5, 8 and 9: its visible tests are
weaker than its hidden ones, and a full implementation passes both.

Runs pytest on copies of the fixture with the host-only reference
implementations (fixtures/python/reference/). Skipped where pytest is not
installed.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import suite

FIXTURE = suite.FIXTURES / "python"

try:
    import pytest  # noqa: F401

    HAVE_PYTEST = True
except ImportError:
    HAVE_PYTEST = False


def run_pytest(implementation: str | None, *, hidden: bool) -> int:
    """Exit code of pytest over the sandbox tree (plus the hidden tests if asked), with a reference duration.py dropped in."""
    with tempfile.TemporaryDirectory() as d:
        work = Path(d) / "work"
        for dest, src in suite.fixture_sandbox_files("python").items():
            p = work / dest.removeprefix("/work/")
            p.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, p)
        if implementation:
            shutil.copy(FIXTURE / "reference" / implementation / "retrykit" / "duration.py", work / "retrykit" / "duration.py")
        args = ["tests"]
        if hidden:
            dest = work / suite.HIDDEN_TESTS_DIR.removeprefix("/work/")
            dest.mkdir(parents=True)
            for f in suite.hidden_test_files("python"):
                shutil.copy(f, dest / f.name)
            args = [str(dest)]
        return subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *args], cwd=work, capture_output=True, text=True).returncode


@unittest.skipUnless(HAVE_PYTEST, "pytest is not installed")
class PythonFixture(unittest.TestCase):
    def test_as_shipped_the_visible_tests_fail_for_want_of_the_feature(self):
        self.assertNotEqual(run_pytest(None, hidden=False), 0)

    def test_a_naive_implementation_passes_the_visible_tests_and_fails_the_hidden_ones(self):
        self.assertEqual(run_pytest("naive", hidden=False), 0)
        self.assertEqual(run_pytest("naive", hidden=True), 1)

    def test_an_implementation_of_every_rule_passes_visible_and_hidden_tests(self):
        self.assertEqual(run_pytest("good", hidden=False), 0)
        self.assertEqual(run_pytest("good", hidden=True), 0)


class PythonFixtureLayout(unittest.TestCase):
    def test_the_sandbox_has_the_package_visible_tests_and_the_feature_spec_but_no_hidden_test_or_reference(self):
        copied = suite.fixture_sandbox_files("python")
        self.assertIn("/work/tests/test_duration.py", copied)
        self.assertIn("/work/docs/FEATURE.md", copied)
        self.assertIn("/work/pyproject.toml", copied)
        names = {p.name for p in copied.values()}
        self.assertNotIn("test_duration_strict.py", names)
        self.assertFalse(any("reference" in p.parts for p in copied.values()))
        self.assertNotIn("/work/retrykit/duration.py", copied)

    def test_the_hidden_check_names_its_test_files(self):
        self.assertEqual([p.name for p in suite.hidden_test_files("python")], ["test_duration_strict.py"])
        self.assertEqual({p.name for p in suite.hidden_files("python")}, {"check.json", "test_duration_strict.py"})


if __name__ == "__main__":
    unittest.main()

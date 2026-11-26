# Reference (host only, never copied into the sandbox)

`fixed/feekit/allocate.py` is a correct `allocate`: integer floors, then the
left-over cents to the largest remainders, ties to the earlier share.

The planted bug in the shipped `sandbox/feekit/allocate.py`: each share is
rounded on its own with `round()`, so the shares need not add up to the total
(100 split three ways gives 33 + 33 + 33 = 99; 200 gives 67 + 67 + 67 = 201),
floats lose cents on large totals, and banker's rounding ignores the tie rule.
The visible tests use only totals that divide evenly, so they pass.
`tests/test_python_bug_fixture.py` checks that the shipped code passes the
visible tests and fails the hidden ones, and that the fix passes both.

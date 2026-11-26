Host-only reference implementations for the fixture's own tests
(tests/test_python_fixture.py). Never copied into the sandbox.

- `good/retrykit/duration.py` follows every rule in docs/FEATURE.md: visible and hidden tests pass.
- `naive/retrykit/duration.py` handles rule 1 only: visible tests pass, hidden tests fail.

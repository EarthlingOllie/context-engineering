"""Hidden tests for parse_duration: every rule in docs/FEATURE.md.

Copied into the sandbox only after the dispatch has finished, and run there by
the scorer. Stricter than the visible tests, which cover rule 1 only.
"""

import pytest

from retrykit.duration import parse_duration


@pytest.mark.parametrize(
    "text, seconds",
    [
        ("45s", 45),
        ("2m", 120),
        ("1h30m", 5400),
        ("1d", 86400),
        ("1d2h3m4s", 86400 + 7200 + 180 + 4),
        ("100s", 100),
        ("0s", 0),
        ("1h0m", 3600),
        ("007m", 420),
    ],
)
def test_rule_1_components_sum_in_seconds(text, seconds):
    assert parse_duration(text) == seconds


def test_rule_1_returns_an_int():
    assert type(parse_duration("1h")) is int


@pytest.mark.parametrize("text, seconds", [("1H30M", 5400), ("2D", 172800), ("1h30M", 5400), ("10S", 10)])
def test_rule_2_units_are_case_insensitive(text, seconds):
    assert parse_duration(text) == seconds


@pytest.mark.parametrize("text, seconds", [("  90s", 90), ("90s  ", 90), ("\t1h\n", 3600)])
def test_rule_3_surrounding_whitespace_is_ignored(text, seconds):
    assert parse_duration(text) == seconds


@pytest.mark.parametrize("text", ["1h 30m", "1 h", "1h\t30m"])
def test_rule_3_inner_whitespace_is_invalid(text):
    with pytest.raises(ValueError):
        parse_duration(text)


@pytest.mark.parametrize("text", ["30m1h", "1s1m", "2m1d", "1m2m", "1h1h", "1s1s"])
def test_rule_4_units_descend_and_appear_once(text):
    with pytest.raises(ValueError):
        parse_duration(text)


@pytest.mark.parametrize("text", ["", "   ", "90", "h", "5w", "-5s", "+5s", "1.5h", "1h30", "s1", "1hm", "abc", "1h-30m", "١s"])
def test_rule_6_invalid_input_raises_value_error(text):
    with pytest.raises(ValueError):
        parse_duration(text)


@pytest.mark.parametrize("value", [None, 90, 1.5, b"90s", ["90s"]])
def test_rule_7_input_that_is_not_a_str_raises_type_error(value):
    with pytest.raises(TypeError):
        parse_duration(value)

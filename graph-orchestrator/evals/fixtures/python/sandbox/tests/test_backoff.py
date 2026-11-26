import pytest

from retrykit.backoff import delays


def test_delays_double_from_the_start_up_to_the_cap():
    assert delays(1, 8, 6) == [1, 2, 4, 8, 8, 8]


def test_no_attempts_means_no_delays():
    assert delays(1, 8, 0) == []


def test_a_cap_below_the_start_is_refused():
    with pytest.raises(ValueError):
        delays(4, 2, 3)

import pytest

from feekit import allocate


def test_an_even_split():
    assert allocate(300, [1, 1, 1]) == [100, 100, 100]


def test_a_split_by_weight():
    assert allocate(1000, [3, 1]) == [750, 250]


def test_a_single_party_takes_the_whole_fee():
    assert allocate(999, [5]) == [999]


def test_negative_weights_are_refused():
    with pytest.raises(ValueError):
        allocate(100, [1, -1])

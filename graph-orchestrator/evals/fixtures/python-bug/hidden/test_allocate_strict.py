"""Hidden tests for feekit.allocate: the whole docstring contract, which the visible tests check only on totals that divide evenly."""

import itertools

import pytest

from feekit import allocate


@pytest.mark.parametrize(
    "total, weights, expected",
    [
        (100, [1, 1, 1], [34, 33, 33]),
        (200, [1, 1, 1], [67, 67, 66]),
        (101, [1, 1], [51, 50]),
        (5, [1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 0]),
        (10, [1, 2, 3], [2, 3, 5]),
        (1, [1, 1], [1, 0]),
        (0, [1, 2], [0, 0]),
        (100, [0, 1], [0, 100]),
        (999, [5], [999]),
        (1000, [3, 1], [750, 250]),
    ],
)
def test_known_splits(total, weights, expected):
    assert allocate(total, weights) == expected


@pytest.mark.parametrize("total", [0, 1, 2, 7, 99, 100, 101, 1001, 123457])
@pytest.mark.parametrize("weights", [[1, 1, 1], [1, 2, 3], [7, 3], [1] * 7, [5, 0, 5], [2, 2, 3, 3]])
def test_shares_add_up_and_stay_within_a_cent_of_exact(total, weights):
    shares = allocate(total, weights)
    assert sum(shares) == total
    assert all(isinstance(s, int) for s in shares)
    whole = sum(weights)
    for share, w in zip(shares, weights):
        floor, ceil = total * w // whole, -(-total * w // whole)
        assert floor <= share <= ceil


def test_the_left_over_cents_go_to_the_largest_remainders_first():
    # exact shares 1.25, 2.5, 3.75, 2.5: floors 1, 2, 3, 2 leave 2 cents; remainders .25 .5 .75 .5
    assert allocate(10, [1, 2, 3, 2]) == [1, 3, 4, 2]


def test_ties_go_to_the_earlier_share():
    for n in range(2, 7):
        for total in range(0, 3 * n):
            shares = allocate(total, [1] * n)
            assert shares == sorted(shares, reverse=True)
            assert max(shares) - min(shares) <= 1


def test_large_totals_are_exact():
    assert allocate(10**18 + 1, [1, 1]) == [5 * 10**17 + 1, 5 * 10**17]


@pytest.mark.parametrize("total, weights", [(-1, [1]), (10, []), (10, [0, 0]), (10, [1, -1])])
def test_bad_input_is_refused(total, weights):
    with pytest.raises(ValueError):
        allocate(total, weights)


def test_every_small_split_adds_up():
    for weights in itertools.product(range(0, 3), repeat=3):
        if sum(weights) == 0:
            continue
        for total in range(0, 12):
            assert sum(allocate(total, list(weights))) == total

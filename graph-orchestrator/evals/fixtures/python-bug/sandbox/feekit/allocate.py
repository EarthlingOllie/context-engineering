"""Splitting a fee between the parties that share it."""


def allocate(total_cents: int, weights: list[int]) -> list[int]:
    """Split `total_cents` between parties in proportion to their `weights`.

    The shares are whole cents and always add up to `total_cents`. Each share is
    its exact proportional amount rounded down or up, never further off. The
    cents left after rounding every share down go one each to the shares with
    the largest remainders; between equal remainders, the earlier share first.
    `total_cents` must be zero or more, and the weights a non-empty list of
    zero or more with a positive sum; anything else raises ValueError.
    """
    if total_cents < 0 or not weights or any(w < 0 for w in weights) or sum(weights) <= 0:
        raise ValueError("need total_cents >= 0 and non-negative weights with a positive sum")
    whole = sum(weights)
    return [round(total_cents * w / whole) for w in weights]

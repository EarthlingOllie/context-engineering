"""Sales summaries over Sale records."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date


@dataclass
class Sale:
    sku: str
    day: date
    units: int
    unit_price: float
    refunded: bool = False


def revenue(sales):
    """Total takings, refunds excluded."""
    return sum(s.units * s.unit_price for s in sales if not s.refunded)


def top_skus(sales, n=3):
    """The n SKUs with the most units sold, most first; ties by SKU."""
    if n < 0:
        raise ValueError("n must be >= 0")
    units = defaultdict(int)
    for s in sales:
        units[s.sku] += s.units
    return [sku for sku, _ in sorted(units.items(), key=lambda kv: (-kv[1], kv[0]))[:n]]


def daily_totals(sales):
    """Revenue per day, oldest first, refunds excluded."""
    out = defaultdict(float)
    for s in sales:
        if not s.refunded:
            out[s.day] += s.units * s.unit_price
    return sorted(out.items())


def refund_rate(sales):
    """Share of sales refunded, 0..1."""
    if not sales:
        raise ValueError("no sales")
    return sum(1 for s in sales if s.refunded) / len(sales)

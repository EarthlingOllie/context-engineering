"""List items from a CSV file: sku,name,qty,price."""

import argparse
import csv
import sys

from inventory.model import Item


def load(path):
    with open(path, newline="") as f:
        return [Item(r["sku"], r["name"], int(r["qty"]), float(r["price"])) for r in csv.DictReader(f)]


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv")
    a = p.parse_args(argv)
    for it in load(a.csv):
        print(f"{it.sku}\t{it.name}\t{it.qty}\t{it.price:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

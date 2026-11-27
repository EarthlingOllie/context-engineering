from dataclasses import dataclass


@dataclass
class Item:
    sku: str
    name: str
    qty: int
    price: float

    def value(self) -> float:
        return self.qty * self.price

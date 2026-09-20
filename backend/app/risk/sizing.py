def position_size(cash: float, price: float, allocation: float, fee: float) -> float:
    """Fractional shares, long-only, no borrowing; fee included in budget."""
    return cash * allocation / (price * (1 + fee))

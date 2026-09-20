import csv
import io
import math
from datetime import date


def parse_csv(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    if not reader.fieldnames or not {"date", "open", "close"}.issubset(reader.fieldnames):
        raise ValueError("Colonnes requises : date,open,close (prix dans une même devise).")
    rows = []
    for row in reader:
        try:
            day = date.fromisoformat(row["date"])
            opening, close = float(row["open"]), float(row["close"])
        except (ValueError, TypeError, KeyError):
            raise ValueError("Date ISO ou prix invalide dans le CSV.") from None
        if not all(math.isfinite(p) and 0 < p < 1e12 for p in (opening, close)):
            raise ValueError("Les prix doivent être positifs et finis.")
        if rows and day.isoformat() <= rows[-1]["date"]:
            raise ValueError("Dates strictement croissantes requises, sans doublon.")
        rows.append({"date": day.isoformat(), "open": opening, "close": close})
        if len(rows) > 10000:
            raise ValueError("Maximum : 10 000 séances.")
    if len(rows) < 4:
        raise ValueError("Au moins 4 séances sont requises.")
    return rows

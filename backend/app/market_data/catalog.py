from app.models.entities import Asset

CATALOG = [
    ("AAPL", "Apple", "stock", "USD", "NASDAQ", "Technologie"),
    ("MSFT", "Microsoft", "stock", "USD", "NASDAQ", "Technologie"),
    ("NVDA", "NVIDIA", "stock", "USD", "NASDAQ", "Technologie"),
    ("AMZN", "Amazon", "stock", "USD", "NASDAQ", "Consommation"),
    ("GOOGL", "Alphabet", "stock", "USD", "NASDAQ", "Communication"),
    ("META", "Meta Platforms", "stock", "USD", "NASDAQ", "Communication"),
    ("TSLA", "Tesla", "stock", "USD", "NASDAQ", "Consommation"),
    ("JPM", "JPMorgan Chase", "stock", "USD", "NYSE", "Finance"),
    ("JNJ", "Johnson & Johnson", "stock", "USD", "NYSE", "Santé"),
    ("SPY", "SPDR S&P 500 ETF Trust", "etf", "USD", "NYSE Arca", "Diversifié"),
    ("QQQ", "Invesco QQQ Trust", "etf", "USD", "NASDAQ", "Diversifié"),
    ("VTI", "Vanguard Total Stock Market ETF", "etf", "USD", "NYSE Arca", "Diversifié"),
    (
        "VEA",
        "Vanguard FTSE Developed Markets ETF",
        "etf",
        "USD",
        "NYSE Arca",
        "Diversifié",
    ),
    (
        "AGG",
        "iShares Core U.S. Aggregate Bond ETF",
        "etf",
        "USD",
        "NYSE Arca",
        "Obligations",
    ),
    ("MC.PA", "LVMH", "stock", "EUR", "Euronext Paris", "Consommation"),
    ("AIR.PA", "Airbus", "stock", "EUR", "Euronext Paris", "Industrie"),
    ("TTE.PA", "TotalEnergies", "stock", "EUR", "Euronext Paris", "Énergie"),
    ("SAN.PA", "Sanofi", "stock", "EUR", "Euronext Paris", "Santé"),
]


def seed(db):
    for row in CATALOG:
        if not db.get(Asset, row[0]):
            db.add(
                Asset(
                    **dict(
                        zip(
                            [
                                "symbol",
                                "name",
                                "kind",
                                "currency",
                                "exchange",
                                "sector",
                            ],
                            row,
                        )
                    )
                )
            )
    db.commit()

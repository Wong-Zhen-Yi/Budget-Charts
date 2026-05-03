import pandas as pd

from app.indicators import calculate_indicators, daily_sma_indicator, macd, mfi, rsi, sma


def sample_frame(length: int = 40) -> pd.DataFrame:
    close = pd.Series(range(1, length + 1), dtype=float)
    return pd.DataFrame(
        {
            "time": list(range(1, length + 1)),
            "open": close - 0.2,
            "high": close + 0.5,
            "low": close - 0.5,
            "close": close,
            "volume": [1000 + index for index in range(length)],
        }
    )


def test_sma_uses_requested_window():
    values = pd.Series(range(1, 21), dtype=float)
    assert sma(values, 20).iloc[-1] == 10.5


def test_rsi_reaches_100_for_consistent_gains():
    values = pd.Series(range(1, 40), dtype=float)
    assert rsi(values, 14).dropna().iloc[-1] == 100


def test_mfi_stays_bounded():
    result = mfi(sample_frame(), 14).dropna()
    assert not result.empty
    assert result.between(0, 100).all()


def test_macd_returns_matching_lengths():
    values = pd.Series(range(1, 40), dtype=float)
    macd_line, signal_line, histogram = macd(values)
    assert len(macd_line) == len(values)
    assert len(signal_line) == len(values)
    assert len(histogram) == len(values)


def test_calculate_indicators_returns_expected_shape():
    result = calculate_indicators(sample_frame())
    assert result["rsi14"]
    assert result["rsi14Ma14"]
    assert result["mfi14"]
    assert result["macd"]["macd"]
    assert result["macd"]["signal"]
    assert result["macd"]["histogram"]


def test_daily_sma_indicator_uses_daily_window():
    result = daily_sma_indicator(sample_frame(220), 200)
    assert len(result) == 21
    assert result[0]["value"] == 100.5

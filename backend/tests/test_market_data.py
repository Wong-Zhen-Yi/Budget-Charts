import pandas as pd
import pytest

from app.market_data import MarketDataError, frame_to_candles, normalize_history, resolve_range


def test_resolve_range_maps_public_label_to_yfinance_values():
    preset = resolve_range("1Y")
    assert preset.period == "1y"
    assert preset.interval == "1d"


def test_resolve_range_rejects_unknown_label():
    with pytest.raises(MarketDataError):
        resolve_range("2Y")


def test_normalize_history_drops_empty_rows_and_adds_epoch_time():
    history = pd.DataFrame(
        {
            "Open": [10.0, None, 12.0],
            "High": [11.0, None, 13.0],
            "Low": [9.0, None, 11.5],
            "Close": [10.5, None, 12.5],
            "Volume": [100, None, 300],
        },
        index=pd.to_datetime(["2026-01-01", "2026-01-02", "2026-01-03"]),
    )

    frame = normalize_history(history)

    assert list(frame.columns) == ["time", "open", "high", "low", "close", "volume"]
    assert len(frame) == 2
    assert frame.iloc[0]["time"] == 1767225600


def test_normalize_history_reports_empty_data():
    with pytest.raises(MarketDataError) as exc:
        normalize_history(pd.DataFrame())
    assert exc.value.status_code == 404


def test_frame_to_candles_serializes_expected_keys():
    frame = pd.DataFrame(
        [{"time": 1, "open": 2, "high": 3, "low": 1, "close": 2.5, "volume": 100}]
    )

    assert frame_to_candles(frame) == [
        {"time": 1, "open": 2.0, "high": 3.0, "low": 1.0, "close": 2.5, "volume": 100}
    ]


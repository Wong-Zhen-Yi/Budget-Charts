from __future__ import annotations

import math
from typing import Iterable

import pandas as pd


def _clean_number(value: float | int | None, digits: int = 4) -> float | None:
    if value is None:
        return None
    numeric = float(value)
    if not math.isfinite(numeric):
        return None
    return round(numeric, digits)


def _points(times: Iterable[int], values: pd.Series, digits: int = 4) -> list[dict]:
    rows: list[dict] = []
    for time_value, value in zip(times, values):
        clean = _clean_number(value, digits)
        if clean is not None:
            rows.append({"time": int(time_value), "value": clean})
    return rows


def sma(close: pd.Series, window: int = 20) -> pd.Series:
    return close.rolling(window=window, min_periods=window).mean()


def rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, pd.NA)
    result = 100 - (100 / (1 + rs))
    result = result.mask((avg_loss == 0) & (avg_gain > 0), 100)
    result = result.mask((avg_loss == 0) & (avg_gain == 0), 50)
    return result


def mfi(frame: pd.DataFrame, window: int = 14) -> pd.Series:
    typical_price = (frame["high"] + frame["low"] + frame["close"]) / 3
    money_flow = typical_price * frame["volume"]
    direction = typical_price.diff()
    positive_flow = money_flow.where(direction > 0, 0)
    negative_flow = money_flow.where(direction < 0, 0)
    positive_sum = positive_flow.rolling(window=window, min_periods=window).sum()
    negative_sum = negative_flow.rolling(window=window, min_periods=window).sum()
    ratio = positive_sum / negative_sum.replace(0, pd.NA)
    result = 100 - (100 / (1 + ratio))
    result = result.mask((negative_sum == 0) & (positive_sum > 0), 100)
    result = result.mask((negative_sum == 0) & (positive_sum == 0), 50)
    return result


def macd(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    fast = close.ewm(span=12, adjust=False).mean()
    slow = close.ewm(span=26, adjust=False).mean()
    macd_line = fast - slow
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calculate_indicators(frame: pd.DataFrame) -> dict:
    times = frame["time"]
    close = frame["close"].astype(float)
    rsi14 = rsi(close, 14)
    macd_line, signal_line, histogram = macd(close)

    return {
        "rsi14": _points(times, rsi14, digits=2),
        "rsi14Ma14": _points(times, sma(rsi14, 14), digits=2),
        "mfi14": _points(times, mfi(frame, 14), digits=2),
        "macd": {
            "macd": _points(times, macd_line),
            "signal": _points(times, signal_line),
            "histogram": _points(times, histogram),
        },
    }


def daily_sma_indicator(frame: pd.DataFrame, window: int = 200) -> list[dict]:
    return _points(frame["time"], sma(frame["close"].astype(float), window))

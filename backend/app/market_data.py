from __future__ import annotations

from dataclasses import dataclass
from datetime import timezone
from typing import Any

import pandas as pd
import yfinance as yf

from .indicators import calculate_indicators, daily_sma_indicator


WATCHLIST = [
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust"},
    {"symbol": "BMNR", "name": "Bitmine Immersion Technologies"},
    {"symbol": "HOOD", "name": "Robinhood Markets, Inc."},
    {"symbol": "MSFT", "name": "Microsoft Corporation"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation"},
    {"symbol": "ORCL", "name": "Oracle Corporation"},
    {"symbol": "MSTR", "name": "Strategy Inc."},
    {"symbol": "SOFI", "name": "SoFi Technologies, Inc."},
]

RANGE_PRESETS = {
    "1D": {"period": "1d", "interval": "5m"},
    "5D": {"period": "5d", "interval": "15m"},
    "1M": {"period": "1mo", "interval": "1h"},
    "3M": {"period": "3mo", "interval": "1d"},
    "6M": {"period": "6mo", "interval": "1d"},
    "YTD": {"period": "ytd", "interval": "1d"},
    "1Y": {"period": "1y", "interval": "1d"},
    "5Y": {"period": "5y", "interval": "1wk"},
    "All": {"period": "max", "interval": "1mo"},
}


class MarketDataError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class RangePreset:
    label: str
    period: str
    interval: str


def resolve_range(label: str) -> RangePreset:
    if label not in RANGE_PRESETS:
        valid = ", ".join(RANGE_PRESETS)
        raise MarketDataError(f"Unsupported range '{label}'. Choose one of: {valid}.")
    preset = RANGE_PRESETS[label]
    return RangePreset(label=label, period=preset["period"], interval=preset["interval"])


def _timestamp_to_unix(value: Any) -> int:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize(timezone.utc)
    else:
        timestamp = timestamp.tz_convert(timezone.utc)
    return int(timestamp.timestamp())


def _finite_float(value: Any) -> float:
    return float(pd.to_numeric(value, errors="coerce"))


def normalize_history(history: pd.DataFrame) -> pd.DataFrame:
    if history is None or history.empty:
        raise MarketDataError("Yahoo Finance returned no price history for this symbol.", 404)

    required = ["Open", "High", "Low", "Close", "Volume"]
    missing = [column for column in required if column not in history.columns]
    if missing:
        joined = ", ".join(missing)
        raise MarketDataError(f"Yahoo Finance response was missing required columns: {joined}.", 502)

    frame = history[required].copy()
    frame.columns = ["open", "high", "low", "close", "volume"]
    for column in frame.columns:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna(subset=["open", "high", "low", "close"])
    frame["volume"] = frame["volume"].fillna(0)

    if frame.empty:
        raise MarketDataError("Yahoo Finance returned only empty candles for this symbol.", 404)

    frame["time"] = [_timestamp_to_unix(value) for value in frame.index]
    frame = frame.reset_index(drop=True)
    return frame[["time", "open", "high", "low", "close", "volume"]]


def frame_to_candles(frame: pd.DataFrame) -> list[dict]:
    candles: list[dict] = []
    for row in frame.itertuples(index=False):
        candles.append(
            {
                "time": int(row.time),
                "open": round(float(row.open), 4),
                "high": round(float(row.high), 4),
                "low": round(float(row.low), 4),
                "close": round(float(row.close), 4),
                "volume": int(row.volume) if pd.notna(row.volume) else 0,
            }
        )
    return candles


def _project_points_to_frame_times(points: list[dict], frame: pd.DataFrame) -> list[dict]:
    projected: list[dict] = []
    if not points:
        return projected

    sorted_points = sorted(points, key=lambda point: int(point["time"]))
    point_index = 0
    latest_value = None

    for time_value in frame["time"]:
        candle_time = int(time_value)
        while point_index < len(sorted_points) and int(sorted_points[point_index]["time"]) <= candle_time:
            latest_value = sorted_points[point_index]["value"]
            point_index += 1

        if latest_value is not None:
            projected.append({"time": candle_time, "value": latest_value})

    return projected


def _quote_from_frame(frame: pd.DataFrame) -> dict:
    latest = frame.iloc[-1]
    previous_close = frame.iloc[-2]["close"] if len(frame) > 1 else latest["open"]
    change = float(latest["close"] - previous_close)
    change_percent = (change / float(previous_close) * 100) if previous_close else 0
    return {
        "last": round(float(latest["close"]), 4),
        "change": round(change, 4),
        "changePercent": round(change_percent, 4),
        "open": round(float(latest["open"]), 4),
        "high": round(float(latest["high"]), 4),
        "low": round(float(latest["low"]), 4),
        "volume": int(latest["volume"]) if pd.notna(latest["volume"]) else 0,
    }


def _ticker_metadata(ticker: yf.Ticker, symbol: str) -> dict:
    try:
        info = ticker.get_info()
    except Exception:
        info = {}

    return {
        "name": info.get("shortName") or info.get("longName") or symbol.upper(),
        "currency": info.get("currency") or "USD",
        "exchange": info.get("exchange") or info.get("fullExchangeName") or "",
    }


def get_chart_payload(symbol: str, range_label: str) -> dict:
    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        raise MarketDataError("Symbol is required.")

    preset = resolve_range(range_label)
    ticker = yf.Ticker(clean_symbol)

    try:
        history = ticker.history(
            period=preset.period,
            interval=preset.interval,
            auto_adjust=False,
            actions=False,
            raise_errors=False,
        )
    except Exception as exc:
        raise MarketDataError(f"Could not fetch {clean_symbol} from Yahoo Finance: {exc}", 502) from exc

    frame = normalize_history(history)
    try:
        daily_history = ticker.history(
            period="5y",
            interval="1d",
            auto_adjust=False,
            actions=False,
            raise_errors=False,
        )
        daily_frame = normalize_history(daily_history)
    except Exception:
        daily_frame = frame
    metadata = _ticker_metadata(ticker, clean_symbol)
    indicators = calculate_indicators(frame)
    indicators["sma200"] = _project_points_to_frame_times(daily_sma_indicator(daily_frame, 200), frame)

    return {
        "symbol": clean_symbol,
        "name": metadata["name"],
        "currency": metadata["currency"],
        "exchange": metadata["exchange"],
        "range": preset.label,
        "interval": preset.interval,
        "updatedAt": pd.Timestamp.now(tz=timezone.utc).isoformat(),
        "quote": _quote_from_frame(frame),
        "candles": frame_to_candles(frame),
        "indicators": indicators,
    }


def search_symbols(query: str) -> list[dict]:
    clean_query = query.strip()
    if len(clean_query) < 1:
        return []

    fallback = [
        item
        for item in WATCHLIST
        if clean_query.upper() in item["symbol"] or clean_query.lower() in item["name"].lower()
    ]

    try:
        results = yf.Search(
            clean_query,
            max_results=8,
            news_count=0,
            lists_count=0,
            include_research=False,
            include_cultural_assets=False,
            raise_errors=False,
        ).quotes
    except Exception:
        results = []

    normalized: list[dict] = []
    seen: set[str] = set()
    for item in results:
        symbol = (item.get("symbol") or "").strip().upper()
        quote_type = item.get("quoteType") or item.get("typeDisp") or ""
        if not symbol or symbol in seen:
            continue
        normalized.append(
            {
                "symbol": symbol,
                "name": item.get("shortname") or item.get("longname") or item.get("name") or symbol,
                "exchange": item.get("exchDisp") or item.get("exchange") or "",
                "type": quote_type,
            }
        )
        seen.add(symbol)

    for item in fallback:
        if item["symbol"] not in seen:
            normalized.append({**item, "exchange": "", "type": "Equity"})
            seen.add(item["symbol"])

    return normalized[:8]

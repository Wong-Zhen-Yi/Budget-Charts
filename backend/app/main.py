from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .market_data import (
    MarketDataError,
    WATCHLIST,
    get_chart_payload,
    get_compare_payload,
    get_multi_chart_payload,
    search_symbols,
)

app = FastAPI(title="Budget Charts API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/watchlist")
def watchlist() -> dict:
    return {"symbols": WATCHLIST}


@app.get("/api/search")
def search(q: str = Query(..., min_length=1)) -> dict:
    return {"results": search_symbols(q)}


@app.get("/api/chart")
def chart(symbol: str = Query("NVDA", min_length=1), range: str = Query("1Y")) -> dict:
    try:
        return get_chart_payload(symbol, range)
    except MarketDataError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"message": exc.message}) from exc


@app.get("/api/compare")
def compare(
    symbols: str = Query(..., min_length=1, description="Comma-separated symbols, e.g. SPY,QQQ,AAPL"),
    range: str = Query("1Y"),
) -> dict:
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail={"message": "At least one symbol is required."})
    if len(symbol_list) > 8:
        raise HTTPException(status_code=400, detail={"message": "Maximum 8 symbols allowed for comparison."})
    try:
        return get_compare_payload(symbol_list, range)
    except MarketDataError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"message": exc.message}) from exc


@app.get("/api/multi")
def multi_charts(
    symbols: str = Query(..., min_length=1, description="Comma-separated symbols"),
    timeframe: str = Query("1D"),
    style: str = Query("Candlestick"),
) -> dict:
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail={"message": "At least one symbol is required."})
    if len(symbol_list) > 24:
        raise HTTPException(status_code=400, detail={"message": "Maximum 24 symbols allowed."})
    try:
        return get_multi_chart_payload(symbol_list, timeframe, style)
    except MarketDataError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"message": exc.message}) from exc

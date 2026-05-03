from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .market_data import MarketDataError, WATCHLIST, get_chart_payload, search_symbols

app = FastAPI(title="Budget Charts API", version="0.1.0")

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


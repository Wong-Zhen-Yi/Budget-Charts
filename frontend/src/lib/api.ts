export const RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'] as const

export type RangeLabel = (typeof RANGES)[number]

export type SeriesPoint = {
  time: number
  value: number
}

export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Quote = {
  last: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  volume: number
}

export type ChartPayload = {
  symbol: string
  name: string
  currency: string
  exchange: string
  range: RangeLabel
  interval: string
  updatedAt: string
  quote: Quote
  candles: Candle[]
  indicators: {
    sma200: SeriesPoint[]
    rsi14: SeriesPoint[]
    rsi14Ma14: SeriesPoint[]
    mfi14: SeriesPoint[]
    macd: {
      macd: SeriesPoint[]
      signal: SeriesPoint[]
      histogram: SeriesPoint[]
    }
  }
}

export type WatchlistSymbol = {
  symbol: string
  name: string
}

export type SearchResult = {
  symbol: string
  name: string
  exchange: string
  type: string
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      body?.detail?.message ?? body?.message ?? `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return body as T
}

export function fetchChart(
  symbol: string,
  range: RangeLabel,
  signal?: AbortSignal,
): Promise<ChartPayload> {
  const params = new URLSearchParams({ symbol, range })
  return requestJson<ChartPayload>(`/api/chart?${params.toString()}`, signal)
}

export async function fetchWatchlist(signal?: AbortSignal): Promise<WatchlistSymbol[]> {
  const response = await requestJson<{ symbols: WatchlistSymbol[] }>('/api/watchlist', signal)
  return response.symbols
}

export async function searchSymbols(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query })
  const response = await requestJson<{ results: SearchResult[] }>(
    `/api/search?${params.toString()}`,
    signal,
  )
  return response.results
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  ListPlus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TradingChart } from './components/TradingChart'
import type { IndicatorVisibility, PaneId } from './components/TradingChart'
import {
  RANGES,
  fetchChart,
  fetchWatchlist,
  searchSymbols,
  type ChartPayload,
  type RangeLabel,
  type SearchResult,
  type WatchlistSymbol,
} from './lib/api'
import './App.css'

const DEFAULT_SYMBOL = 'NVDA'
const DEFAULT_RANGE: RangeLabel = '1Y'
const WATCHLIST_STORAGE_KEY = 'budget-charts-watchlist'
const DEFAULT_INDICATORS: IndicatorVisibility = {
  sma: true,
  volume: true,
  rsi: true,
  mfi: true,
  macd: true,
}

const INDICATOR_OPTIONS: { key: keyof IndicatorVisibility; label: string; hint: string }[] = [
  { key: 'sma', label: 'SMA 200', hint: 'Daily moving average' },
  { key: 'volume', label: 'Volume', hint: 'Volume bars' },
  { key: 'rsi', label: 'RSI', hint: 'Relative strength pane' },
  { key: 'mfi', label: 'MFI', hint: 'Money flow pane' },
  { key: 'macd', label: 'MACD', hint: 'Trend pane' },
]

const DEFAULT_PANE_ORDER: PaneId[] = ['stock', 'rsi', 'mfi', 'macd']

const PANE_OPTIONS: { key: PaneId; label: string; hint: string }[] = [
  { key: 'stock', label: 'Stock Chart', hint: 'Candles and price' },
  { key: 'rsi', label: 'RSI', hint: 'Relative strength' },
  { key: 'mfi', label: 'MFI', hint: 'Money flow' },
  { key: 'macd', label: 'MACD', hint: 'Trend and momentum' },
]

function formatPrice(value: number | undefined, currency = 'USD') {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value > 100 ? 2 : 4,
  }).format(value)
}

function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatTime(value: string | undefined) {
  if (!value) {
    return 'Not updated yet'
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function mergeWatchlists(base: WatchlistSymbol[], additions: WatchlistSymbol[]) {
  const seen = new Set<string>()
  const merged: WatchlistSymbol[] = []

  for (const item of [...base, ...additions]) {
    const symbol = item.symbol.trim().toUpperCase()
    if (!symbol || seen.has(symbol)) {
      continue
    }
    merged.push({ symbol, name: item.name || symbol })
    seen.add(symbol)
  }

  return merged
}

function readSavedWatchlist() {
  try {
    const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY)
    if (!saved) {
      return []
    }
    const parsed = JSON.parse(saved) as WatchlistSymbol[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item) => item?.symbol)
  } catch {
    return []
  }
}

function App() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [range, setRange] = useState<RangeLabel>(DEFAULT_RANGE)
  const [query, setQuery] = useState(DEFAULT_SYMBOL)
  const [chartData, setChartData] = useState<ChartPayload | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistSymbol[]>([])
  const [addTickerValue, setAddTickerValue] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [indicators, setIndicators] = useState<IndicatorVisibility>(DEFAULT_INDICATORS)
  const [paneOrder, setPaneOrder] = useState<PaneId[]>(DEFAULT_PANE_ORDER)
  const [indicatorsOpen, setIndicatorsOpen] = useState(false)
  const [paneOrderOpen, setPaneOrderOpen] = useState(false)
  const [watchlistLoaded, setWatchlistLoaded] = useState(false)
  const [isChartLoading, setIsChartLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const quoteTone = chartData && chartData.quote.change < 0 ? 'negative' : 'positive'
  const chartFitKey = `${symbol}:${range}`

  const loadChart = useCallback(
    async (nextSymbol: string, nextRange: RangeLabel, silent = false, signal?: AbortSignal) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsChartLoading(true)
      }
      setError(null)

      try {
        const payload = await fetchChart(nextSymbol, nextRange, signal)
        if (requestIdRef.current === requestId) {
          setChartData(payload)
          if (!silent) {
            setQuery(payload.symbol)
            setSearchOpen(false)
          }
        }
      } catch (caught) {
        if (!signal?.aborted && requestIdRef.current === requestId) {
          setError(caught instanceof Error ? caught.message : 'Market data request failed.')
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsChartLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    const initialLoadId = window.setTimeout(() => {
      loadChart(symbol, range, false, controller.signal)
    }, 0)
    const refreshId = window.setInterval(() => {
      loadChart(symbol, range, true)
    }, 60_000)

    return () => {
      controller.abort()
      window.clearTimeout(initialLoadId)
      window.clearInterval(refreshId)
    }
  }, [loadChart, range, symbol])

  useEffect(() => {
    const controller = new AbortController()
    fetchWatchlist(controller.signal)
      .then((defaultWatchlist) => {
        setWatchlist(mergeWatchlists(defaultWatchlist, readSavedWatchlist()))
        setWatchlistLoaded(true)
      })
      .catch(() => {
        setWatchlist(readSavedWatchlist())
        setWatchlistLoaded(true)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!watchlistLoaded) {
      return
    }
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist))
  }, [watchlist, watchlistLoaded])

  useEffect(() => {
    const trimmed = query.trim()
    if (!searchOpen || trimmed.length < 2 || trimmed.toUpperCase() === symbol) {
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      searchSymbols(trimmed, controller.signal)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchOpen, symbol])

  const visibleSearchResults = useMemo(
    () =>
      query.trim().length < 2
        ? []
        : searchOpen
          ? searchResults.filter((result) => result.symbol !== symbol).slice(0, 6)
          : [],
    [query, searchOpen, searchResults, symbol],
  )

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSymbol = query.trim().toUpperCase()
    if (!nextSymbol) {
      return
    }
    setSearchResults([])
    setSearchOpen(false)
    setSymbol(nextSymbol)
  }

  function selectSymbol(nextSymbol: string) {
    const cleanSymbol = nextSymbol.trim().toUpperCase()
    setQuery(cleanSymbol)
    setSearchResults([])
    setSearchOpen(false)
    setSymbol(cleanSymbol)
  }

  function addTicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanSymbol = addTickerValue.trim().toUpperCase()
    if (!cleanSymbol) {
      return
    }

    setWatchlist((current) =>
      mergeWatchlists(current, [
        {
          symbol: cleanSymbol,
          name: chartData?.symbol === cleanSymbol ? chartData.name : cleanSymbol,
        },
      ]),
    )
    setAddTickerValue('')
    selectSymbol(cleanSymbol)
  }

  function toggleIndicator(key: keyof IndicatorVisibility) {
    setIndicators((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  function movePane(key: PaneId, direction: -1 | 1) {
    setPaneOrder((current) => {
      const currentIndex = current.indexOf(key)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }

      const next = [...current]
      const [item] = next.splice(currentIndex, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  return (
    <main className="terminal">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Activity size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="brand-title">Budget Charts</div>
            <div className="brand-subtitle">Local yfinance terminal</div>
          </div>
        </div>

        <form className="symbol-search" onSubmit={submitSearch}>
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Ticker symbol"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setSearchOpen(true)
            }}
            spellCheck={false}
            autoComplete="off"
          />
          {searchLoading ? <span className="search-status">Searching</span> : null}
          {visibleSearchResults.length ? (
            <div className="search-menu" role="listbox">
              {visibleSearchResults.map((result) => (
                <button
                  key={result.symbol}
                  type="button"
                  onClick={() => selectSymbol(result.symbol)}
                  role="option"
                >
                  <strong>{result.symbol}</strong>
                  <span>{result.name}</span>
                  <small>{result.exchange || result.type}</small>
                </button>
              ))}
            </div>
          ) : null}
        </form>

        <div className="range-strip" aria-label="Chart range">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={item === range ? 'active' : ''}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="icon-button"
          title="Refresh market data"
          aria-label="Refresh market data"
          onClick={() => loadChart(symbol, range, true)}
        >
          <RefreshCw size={17} className={isRefreshing ? 'spin' : ''} aria-hidden="true" />
        </button>
      </header>

      <section className="market-summary" aria-label="Quote summary">
        <div>
          <div className="summary-label">Symbol</div>
          <div className="summary-symbol">{chartData?.symbol ?? symbol}</div>
        </div>
        <div>
          <div className="summary-label">Last</div>
          <div className="summary-value">{formatPrice(chartData?.quote.last, chartData?.currency)}</div>
        </div>
        <div>
          <div className="summary-label">Change</div>
          <div className={`summary-value ${quoteTone}`}>
            {chartData?.quote.change && chartData.quote.change < 0 ? (
              <TrendingDown size={17} aria-hidden="true" />
            ) : (
              <TrendingUp size={17} aria-hidden="true" />
            )}
            {chartData ? `${chartData.quote.change >= 0 ? '+' : ''}${chartData.quote.change.toFixed(2)}` : '--'}
          </div>
        </div>
        <div>
          <div className="summary-label">Percent</div>
          <div className={`summary-value ${quoteTone}`}>{formatPercent(chartData?.quote.changePercent)}</div>
        </div>
        <div>
          <div className="summary-label">Last Updated</div>
          <div className="summary-value muted">
            <Clock3 size={16} aria-hidden="true" />
            {formatTime(chartData?.updatedAt)}
          </div>
        </div>
      </section>

      {error ? (
        <div className="error-banner" role="alert">
          <Sparkles size={17} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <div className="workspace">
        <TradingChart
          data={chartData}
          fitKey={chartFitKey}
          isLoading={isChartLoading || isRefreshing}
          indicators={indicators}
          paneOrder={paneOrder}
        />

        <aside className="watchlist-panel" aria-label="Watchlist">
          <section className="indicator-controls" aria-label="Technical indicators">
            <button
              type="button"
              className="section-toggle"
              aria-expanded={indicatorsOpen}
              onClick={() => setIndicatorsOpen((open) => !open)}
            >
              <span>Indicators</span>
              <ChevronDown size={16} className={indicatorsOpen ? 'expanded' : ''} aria-hidden="true" />
            </button>
            {indicatorsOpen ? (
              <div className="toggle-list">
                {INDICATOR_OPTIONS.map((option) => (
                  <label key={option.key} className="indicator-toggle">
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={indicators[option.key]}
                      onChange={() => toggleIndicator(option.key)}
                    />
                    <span className="toggle-track" aria-hidden="true" />
                  </label>
                ))}
              </div>
            ) : null}
          </section>

          <section className="pane-controls" aria-label="Pane order">
            <button
              type="button"
              className="section-toggle"
              aria-expanded={paneOrderOpen}
              onClick={() => setPaneOrderOpen((open) => !open)}
            >
              <span>Pane Order</span>
              <ChevronDown size={16} className={paneOrderOpen ? 'expanded' : ''} aria-hidden="true" />
            </button>
            {paneOrderOpen ? (
              <div className="pane-list">
                {paneOrder.map((paneId, index) => {
                  const pane = PANE_OPTIONS.find((option) => option.key === paneId)
                  if (!pane) {
                    return null
                  }

                  return (
                    <div key={pane.key} className="pane-row">
                      <span>
                        <strong>{pane.label}</strong>
                        <small>{pane.hint}</small>
                      </span>
                      <div className="pane-actions">
                        <button
                          type="button"
                          aria-label={`Move ${pane.label} up`}
                          disabled={index === 0}
                          onClick={() => movePane(pane.key, -1)}
                        >
                          <ChevronUp size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${pane.label} down`}
                          disabled={index === paneOrder.length - 1}
                          onClick={() => movePane(pane.key, 1)}
                        >
                          <ChevronDown size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </section>

          <div className="watchlist-heading">
            <div>
              <h2>Watchlist</h2>
              <span>{watchlist.length} tickers saved locally</span>
            </div>
            <Database size={18} aria-hidden="true" />
          </div>

          <form className="add-ticker-form" onSubmit={addTicker}>
            <ListPlus size={15} aria-hidden="true" />
            <input
              aria-label="Add ticker to watchlist"
              value={addTickerValue}
              onChange={(event) => setAddTickerValue(event.target.value)}
              placeholder="Add ticker"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" aria-label="Add ticker">
              <Plus size={15} aria-hidden="true" />
            </button>
          </form>

          <div className="watchlist-table">
            {watchlist.map((item) => {
              const selected = item.symbol === symbol
              return (
                <button
                  key={item.symbol}
                  type="button"
                  className={selected ? 'selected' : ''}
                  aria-label={`Open ${item.symbol} ${item.name}`}
                  onClick={() => selectSymbol(item.symbol)}
                >
                  <span className="ticker-dot">{item.symbol.slice(0, 1)}</span>
                  <span>
                    <strong>{item.symbol}</strong>
                    <small>{item.name}</small>
                  </span>
                  <span className={selected ? quoteTone : 'muted'}>
                    {selected ? formatPercent(chartData?.quote.changePercent) : 'Open'}
                  </span>
                </button>
              )
            })}
          </div>

          <footer className="attribution">
            Charts powered by{' '}
            <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer">
              Lightweight Charts
            </a>
          </footer>
        </aside>
      </div>
    </main>
  )
}

export default App

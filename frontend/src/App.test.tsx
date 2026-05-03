import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/TradingChart', () => ({
  TradingChart: ({ data }: { data: { symbol: string; name: string } | null }) => (
    <div data-testid="mock-chart">{data ? `${data.symbol} · ${data.name}` : 'empty'}</div>
  ),
}))

const chartPayload = (symbol: string) => ({
  symbol,
  name: `${symbol} Incorporated`,
  currency: 'USD',
  exchange: 'NASDAQ',
  range: '1Y',
  interval: '1d',
  updatedAt: '2026-04-26T02:15:30.000Z',
  quote: {
    last: 208.27,
    change: 8.63,
    changePercent: 4.32,
    open: 199.96,
    high: 210.95,
    low: 199.81,
    volume: 214130000,
  },
  candles: [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
    { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 200 },
  ],
  indicators: {
    sma200: [],
    rsi14: [],
    rsi14Ma14: [],
    mfi14: [],
    macd: {
      macd: [],
      signal: [],
      histogram: [],
    },
  },
})

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()

        if (url.startsWith('/api/watchlist')) {
          return Promise.resolve(
            Response.json({
              symbols: [
                { symbol: 'NVDA', name: 'NVIDIA Corporation' },
                { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
              ],
            }),
          )
        }

        if (url.startsWith('/api/search')) {
          return Promise.resolve(
            Response.json({
              results: [{ symbol: 'HOOD', name: 'Robinhood Markets, Inc.', exchange: 'NASDAQ', type: 'Equity' }],
            }),
          )
        }

        if (url.startsWith('/api/chart')) {
          const parsed = new URL(url, 'http://localhost')
          return Promise.resolve(Response.json(chartPayload(parsed.searchParams.get('symbol') ?? 'NVDA')))
        }

        return Promise.resolve(Response.json({}, { status: 404 }))
      }),
    )
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads NVDA by default', async () => {
    render(<App />)

    expect(await screen.findByText('NVDA · NVDA Incorporated')).toBeInTheDocument()
    expect(screen.getByTestId('mock-chart')).toHaveTextContent('NVDA')
  })

  it('fetches a new chart when selecting a watchlist symbol', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('NVDA · NVDA Incorporated')
    await user.click(screen.getByRole('button', { name: /Open HOOD Robinhood Markets/i }))

    await waitFor(() => expect(screen.getByTestId('mock-chart')).toHaveTextContent('HOOD'))
    expect(fetch).toHaveBeenCalledWith('/api/chart?symbol=HOOD&range=1Y', expect.any(Object))
  })

  it('adds a typed symbol to the watchlist and opens it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('NVDA · NVDA Incorporated')
    await user.type(screen.getByLabelText('Add ticker to watchlist'), 'sofi')
    await user.click(screen.getByRole('button', { name: 'Add ticker' }))

    await waitFor(() => expect(screen.getByTestId('mock-chart')).toHaveTextContent('SOFI'))
    expect(screen.getByRole('button', { name: /Open SOFI SOFI/i })).toBeInTheDocument()
    expect(localStorage.getItem('budget-charts-watchlist')).toContain('SOFI')
  })
})

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts'
import type { ComparePayload, SeriesPoint } from '../lib/api'

type CompareChartProps = {
  data: ComparePayload | null
  isLoading: boolean
}

const COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

const panelBackground = '#11151f'
const gridColor = '#242a36'
const textColor = '#b8c0cc'

function toLineData(points: SeriesPoint[]): LineData<Time>[] {
  return points.map((p) => ({ time: p.time as Time, value: p.value }))
}

function formatPct(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

interface TaggedSeries extends ISeriesApi<'Line', Time> {
  _sym?: string
}

export function CompareChart({ data, isLoading }: CompareChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<TaggedSeries[]>([])
  const [hoverData, setHoverData] = useState<Map<string, number>>(new Map())

  const symbolColors = useMemo(() => {
    const map = new Map<string, string>()
    if (data?.symbols) {
      data.symbols.forEach((s, i) => {
        map.set(s.symbol, COLORS[i % COLORS.length])
      })
    }
    return map
  }, [data?.symbols])

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return undefined

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: panelBackground },
        textColor,
        fontFamily: "Inter, ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: '#2f3542',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: '#2f3542',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 9,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#7f8794',
          labelBackgroundColor: '#2b3442',
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#7f8794',
          labelBackgroundColor: '#2b3442',
          style: LineStyle.Dashed,
        },
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    })

    chartRef.current = chart

    const crosshairHandler = (param: MouseEventParams<Time>) => {
      const next = new Map<string, number>()
      for (const series of seriesRef.current) {
        const point = param.seriesData.get(series) as LineData<Time> | undefined
        if (point && series._sym) {
          next.set(series._sym, (point as unknown as { value: number }).value)
        }
      }
      setHoverData(next)
    }

    chart.subscribeCrosshairMove(crosshairHandler)

    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler)
      chart.remove()
      chartRef.current = null
      seriesRef.current = []
    }
  }, [])

  // Update series data
  useEffect(() => {
    if (!chartRef.current || !data?.symbols.length) return

    const chart = chartRef.current

    for (const s of seriesRef.current) {
      try { chart.removeSeries(s) } catch { /* ignore */ }
    }
    seriesRef.current = []

    for (const sym of data.symbols) {
      const color = symbolColors.get(sym.symbol) || '#888888'
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: sym.symbol,
      }) as TaggedSeries
      series._sym = sym.symbol
      series.setData(toLineData(sym.percentSeries))
      seriesRef.current.push(series)
    }

    chart.timeScale().fitContent()
  }, [data, symbolColors])

  if (!data?.symbols.length && !isLoading) {
    return (
      <section className="chart-shell" aria-label="Compare charts">
        <div className="compare-empty">
          <p>Add symbols above to compare their performance</p>
          <span>Normalized percentage change from the first candle</span>
        </div>
      </section>
    )
  }

  return (
    <section className="chart-shell" aria-label="Compare charts">
      <div className="chart-legend">
        <div className="compare-legend-symbols">
          {data?.symbols.map((s) => {
            const color = symbolColors.get(s.symbol) || '#888'
            const hoverValue = hoverData.get(s.symbol)
            return (
              <div key={s.symbol} className="compare-legend-item" style={{ borderColor: color }}>
                <span className="compare-sym-name">{s.symbol}</span>
                <span className="compare-sym-value" style={{ color }}>
                  {hoverValue !== undefined ? formatPct(hoverValue) : formatPct(s.changePct)}
                </span>
                <span className="compare-sym-price">${s.lastClose.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="chart-frame">
        <div ref={containerRef} className="chart-container" />
        {isLoading && <div className="chart-loading">Loading comparison...</div>}
      </div>
    </section>
  )
}

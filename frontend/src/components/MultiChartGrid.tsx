import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import type { MultiChartPayload } from '../lib/api'

type MultiChartGridProps = {
  data: MultiChartPayload | null
  isLoading: boolean
  chartStyle: string
  onRemoveSymbol?: (symbol: string) => void
  onReorder?: (symbols: string[]) => void
}

const positive = '#00b894'
const negative = '#ff4d5f'
const panelBackground = '#11151f'
const gridColor = '#242a36'
const textColor = '#b8c0cc'
const cardBg = '#11151f'
const cardBorder = '#2b3140'

interface CardChart {
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick', Time> | null
  lineSeries: ISeriesApi<'Line', Time> | null
}

export function MultiChartGrid({ data, isLoading, chartStyle }: MultiChartGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const cardChartsRef = useRef<Map<string, CardChart>>(new Map())
  const [cols, setCols] = useState(3)

  // Responsive column count
  useEffect(() => {
    const updateCols = () => {
      if (gridRef.current) {
        const w = gridRef.current.clientWidth
        setCols(Math.max(1, Math.floor(w / 380)))
      }
    }
    updateCols()
    window.addEventListener('resize', updateCols)
    return () => window.removeEventListener('resize', updateCols)
  }, [])

  // Cleanup charts on unmount
  useEffect(() => {
    const charts = cardChartsRef.current
    return () => {
      charts.forEach((c) => c.chart.remove())
      charts.clear()
    }
  }, [])

  // Sync charts with data
  useEffect(() => {
    if (!data?.charts.length) return

    const currentSymbols = new Set(data.charts.map((c) => c.symbol))
    const charts = cardChartsRef.current

    // Remove charts for symbols no longer present
    for (const [sym, cardChart] of charts.entries()) {
      if (!currentSymbols.has(sym)) {
        cardChart.chart.remove()
        charts.delete(sym)
      }
    }

    // Update or create charts
    for (const chartData of data.charts) {
      let cardChart = charts.get(chartData.symbol)

      if (!cardChart) {
        // Create card container
        const cardEl = document.createElement('div')
        cardEl.className = 'mc-card'
        cardEl.style.background = cardBg
        cardEl.style.border = `1px solid ${cardBorder}`
        cardEl.style.borderRadius = '6px'
        cardEl.style.overflow = 'hidden'
        cardEl.style.minHeight = '280px'
        cardEl.style.display = 'flex'
        cardEl.style.flexDirection = 'column'

        const chartContainer = document.createElement('div')
        chartContainer.style.flex = '1'
        chartContainer.style.minHeight = '180px'
        cardEl.appendChild(chartContainer)

        gridRef.current?.appendChild(cardEl)

        const chart = createChart(chartContainer, {
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
            visible: false,
            borderColor: '#2f3542',
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
            axisPressedMouseMove: false,
            mouseWheel: false,
            pinch: false,
          },
          handleScroll: {
            mouseWheel: false,
            pressedMouseMove: false,
          },
        })

        let candleSeries: ISeriesApi<'Candlestick', Time> | null = null
        let lineSeries: ISeriesApi<'Line', Time> | null = null

        if (chartStyle === 'Line') {
          lineSeries = chart.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          })
        } else {
          candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: positive,
            downColor: negative,
            borderVisible: false,
            wickUpColor: positive,
            wickDownColor: negative,
            priceLineColor: '#35d0ba',
          })
        }

        cardChart = { chart, candleSeries, lineSeries }
        charts.set(chartData.symbol, cardChart)
      }

      // Update data
      if (cardChart.candleSeries && chartStyle !== 'Line') {
        cardChart.candleSeries.setData(
          chartData.candles.map(
            (c): CandlestickData<Time> => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }),
          ),
        )
      }

      if (cardChart.lineSeries && chartStyle === 'Line') {
        cardChart.lineSeries.setData(
          chartData.candles.map((c) => ({
            time: c.time as Time,
            value: c.close,
          })),
        )
      }

      cardChart.chart.timeScale().fitContent()
    }
  }, [data, chartStyle])

  if (!data?.charts.length && !isLoading) {
    return (
      <div className="mc-empty">
        <p>Add symbols to see multiple charts</p>
      </div>
    )
  }

  return (
    <div className="mc-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {isLoading && data?.charts.length === 0 && (
        <div className="mc-loading">Loading charts...</div>
      )}
    </div>
  )
}

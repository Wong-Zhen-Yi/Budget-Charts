import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts'
import type { Candle, ChartPayload } from '../lib/api'

export type IndicatorVisibility = {
  sma: boolean
  volume: boolean
  rsi: boolean
  mfi: boolean
  macd: boolean
}

export type PaneId = 'stock' | 'rsi' | 'mfi' | 'macd'

type SeriesRefs = {
  candles: ISeriesApi<'Candlestick', Time>
  sma: ISeriesApi<'Line', Time>
  volume: ISeriesApi<'Histogram', Time>
  rsi: ISeriesApi<'Line', Time>
  rsiMa: ISeriesApi<'Line', Time>
  mfi: ISeriesApi<'Line', Time>
  macd: ISeriesApi<'Line', Time>
  signal: ISeriesApi<'Line', Time>
  histogram: ISeriesApi<'Histogram', Time>
}

type TradingChartProps = {
  data: ChartPayload | null
  fitKey: string
  isLoading: boolean
  indicators: IndicatorVisibility
  paneOrder: PaneId[]
}

const positive = '#00b894'
const negative = '#ff4d5f'
const panelBackground = '#11151f'
const gridColor = '#242a36'
const textColor = '#b8c0cc'

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

function formatCompact(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function getLastCandle(data: ChartPayload | null) {
  if (!data?.candles.length) {
    return null
  }
  return data.candles[data.candles.length - 1]
}

function toLineData(points: { time: number; value: number }[]): LineData<Time>[] {
  return points.map((point) => ({ time: point.time as Time, value: point.value }))
}

export function TradingChart({ data, fitKey, isLoading, indicators, paneOrder }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<SeriesRefs | null>(null)
  const fittedKeyRef = useRef<string>('')
  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null)

  const activeCandle = hoverCandle ?? getLastCandle(data)
  const isPositive = data ? data.quote.change >= 0 : true
  const macdLatest = useMemo(() => data?.indicators.macd.histogram.at(-1)?.value, [data])

  useEffect(() => {
    if (!containerRef.current) {
      return undefined
    }

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
        scaleMargins: { top: 0.08, bottom: 0.18 },
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
      localization: {
        priceFormatter: (price: number) => price.toFixed(price > 100 ? 2 : 4),
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

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: positive,
      downColor: negative,
      borderVisible: false,
      wickUpColor: positive,
      wickDownColor: negative,
      priceLineColor: '#35d0ba',
    })

    const smaSeries = chart.addSeries(LineSeries, {
      color: '#f3c74e',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'SMA 200 · 1D',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    })

    const rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: '#8d67d9',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'RSI 14',
      },
      1,
    )

    const rsiMaSeries = chart.addSeries(
      LineSeries,
      {
        color: '#f3c74e',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'RSI MA 14',
      },
      1,
    )

    const mfiSeries = chart.addSeries(
      LineSeries,
      {
        color: '#39c5bb',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'MFI 14',
      },
      2,
    )

    mfiSeries.createPriceLine({
      price: 80,
      color: '#495164',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })
    mfiSeries.createPriceLine({
      price: 20,
      color: '#495164',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })

    rsiSeries.createPriceLine({
      price: 70,
      color: '#495164',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })
    rsiSeries.createPriceLine({
      price: 30,
      color: '#495164',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })

    const histogram = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'MACD Histogram',
      },
      3,
    )

    const macdSeries = chart.addSeries(
      LineSeries,
      {
        color: '#2f74ff',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'MACD',
      },
      3,
    )

    const signalSeries = chart.addSeries(
      LineSeries,
      {
        color: '#ff8a3d',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'Signal',
      },
      3,
    )

    chart.panes()[0]?.setStretchFactor(6)
    chart.panes()[1]?.setStretchFactor(2)
    chart.panes()[2]?.setStretchFactor(2)
    chart.panes()[3]?.setStretchFactor(2)

    const crosshairHandler = (param: MouseEventParams<Time>) => {
      const value = param.seriesData.get(candles) as CandlestickData<Time> | undefined
      if (!value) {
        setHoverCandle(null)
        return
      }

      setHoverCandle({
        time: Number(value.time),
        open: value.open,
        high: value.high,
        low: value.low,
        close: value.close,
        volume: 0,
      })
    }

    chart.subscribeCrosshairMove(crosshairHandler)

    chartRef.current = chart
    seriesRef.current = {
      candles,
      sma: smaSeries,
      volume: volumeSeries,
      rsi: rsiSeries,
      rsiMa: rsiMaSeries,
      mfi: mfiSeries,
      macd: macdSeries,
      signal: signalSeries,
      histogram,
    }

    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) {
      return
    }

    const chart = chartRef.current
    const refs = seriesRef.current

    const paneIdAt = (index: number): PaneId | null => {
      const pane = chart.panes()[index]
      if (!pane) {
        return null
      }
      const paneSeries = pane.getSeries()
      if (paneSeries.some((series) => series === refs.candles)) {
        return 'stock'
      }
      if (paneSeries.some((series) => series === refs.rsi)) {
        return 'rsi'
      }
      if (paneSeries.some((series) => series === refs.mfi)) {
        return 'mfi'
      }
      if (paneSeries.some((series) => series === refs.macd || series === refs.signal || series === refs.histogram)) {
        return 'macd'
      }
      return null
    }

    for (let targetIndex = 0; targetIndex < paneOrder.length; targetIndex += 1) {
      if (paneIdAt(targetIndex) === paneOrder[targetIndex]) {
        continue
      }

      const currentIndex = chart
        .panes()
        .findIndex((_, index) => paneIdAt(index) === paneOrder[targetIndex])

      if (currentIndex >= 0 && currentIndex !== targetIndex) {
        chart.swapPanes(currentIndex, targetIndex)
      }
    }
  }, [paneOrder])

  useEffect(() => {
    if (!data || !chartRef.current || !seriesRef.current) {
      return
    }

    const series = seriesRef.current
    series.candles.setData(
      data.candles.map(
        (candle): CandlestickData<Time> => ({
          time: candle.time as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }),
      ),
    )
    series.sma.setData(indicators.sma ? toLineData(data.indicators.sma200) : [])
    series.volume.setData(
      indicators.volume
        ? data.candles.map(
            (candle): HistogramData<Time> => ({
              time: candle.time as Time,
              value: candle.volume,
              color:
                candle.close >= candle.open
                  ? 'rgba(0, 184, 148, 0.34)'
                  : 'rgba(255, 77, 95, 0.34)',
            }),
          )
        : [],
    )
    series.rsi.setData(indicators.rsi ? toLineData(data.indicators.rsi14) : [])
    series.rsiMa.setData(indicators.rsi ? toLineData(data.indicators.rsi14Ma14) : [])
    series.mfi.setData(indicators.mfi ? toLineData(data.indicators.mfi14) : [])
    series.histogram.setData(
      indicators.macd
        ? data.indicators.macd.histogram.map(
            (point): HistogramData<Time> => ({
              time: point.time as Time,
              value: point.value,
              color: point.value >= 0 ? '#73d8d2' : '#ff7180',
            }),
          )
        : [],
    )
    series.macd.setData(indicators.macd ? toLineData(data.indicators.macd.macd) : [])
    series.signal.setData(indicators.macd ? toLineData(data.indicators.macd.signal) : [])
    series.rsi.priceScale().setVisibleRange({ from: 0, to: 100 })
    series.mfi.priceScale().setVisibleRange({ from: 0, to: 100 })
    chartRef.current.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.08,
        bottom: indicators.volume ? 0.18 : 0.08,
      },
    })
    chartRef.current.panes().forEach((pane) => {
      const paneSeries = pane.getSeries()
      if (paneSeries.some((series) => series === seriesRef.current?.candles)) {
        pane.setStretchFactor(6)
      } else if (paneSeries.some((series) => series === seriesRef.current?.rsi)) {
        pane.setStretchFactor(indicators.rsi ? 2 : 0.05)
      } else if (paneSeries.some((series) => series === seriesRef.current?.mfi)) {
        pane.setStretchFactor(indicators.mfi ? 2 : 0.05)
      } else if (
        paneSeries.some(
          (series) =>
            series === seriesRef.current?.macd ||
            series === seriesRef.current?.signal ||
            series === seriesRef.current?.histogram,
        )
      ) {
        pane.setStretchFactor(indicators.macd ? 2 : 0.05)
      }
    })

    if (fittedKeyRef.current !== fitKey) {
      chartRef.current.timeScale().fitContent()
      fittedKeyRef.current = fitKey
    }
  }, [data, fitKey, indicators])

  return (
    <section className="chart-shell" aria-label="Market chart">
      <div className="chart-legend">
        <div>
          <div className="legend-title">
            {data ? `${data.symbol} · ${data.name}` : 'Loading market data'}
          </div>
          <div className="legend-subtitle">
            {data ? `${data.interval} candles · ${data.exchange || 'Yahoo Finance'}` : 'Connecting'}
          </div>
        </div>
        {activeCandle ? (
          <div className="ohlc-strip" aria-label="OHLC values">
            <span>O {formatPrice(activeCandle.open, data?.currency)}</span>
            <span>H {formatPrice(activeCandle.high, data?.currency)}</span>
            <span>L {formatPrice(activeCandle.low, data?.currency)}</span>
            <span>C {formatPrice(activeCandle.close, data?.currency)}</span>
            <span>Vol {formatCompact(getLastCandle(data)?.volume)}</span>
          </div>
        ) : null}
        <div className="indicator-pills">
          {indicators.sma ? <span>SMA 200 · 1D</span> : null}
          {indicators.volume ? <span>Vol</span> : null}
          {indicators.rsi ? <span>RSI + MA</span> : null}
          {indicators.mfi ? <span>MFI</span> : null}
          {indicators.macd ? (
            <span className={macdLatest && macdLatest < 0 ? 'negative' : 'positive'}>MACD</span>
          ) : null}
        </div>
      </div>

      <div className="chart-frame">
        <div ref={containerRef} className="chart-container" data-testid="chart-canvas" />
        {isLoading ? <div className="chart-loading">Updating</div> : null}
        {data ? (
          <div className={`price-badge ${isPositive ? 'positive' : 'negative'}`}>
            {formatPrice(data.quote.last, data.currency)}
          </div>
        ) : null}
      </div>
    </section>
  )
}

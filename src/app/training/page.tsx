"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import {
  ArrowLeft,
  BarChart3,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Settings2,
} from "lucide-react";

type Timeframe = "D1" | "H4" | "H1";
type Instrument = "eurusd" | "xauusd" | "usatechidxusd";

const instrumentDetails: Record<
  Instrument,
  { label: string; shortLabel: string; description: string; decimals: number }
> = {
  eurusd: { label: "EUR/USD", shortLabel: "EURUSD", description: "Euro / US Dollar", decimals: 5 },
  xauusd: { label: "Gold (XAU/USD)", shortLabel: "XAUUSD", description: "Gold / US Dollar", decimals: 2 },
  usatechidxusd: { label: "NAS100", shortLabel: "NAS100", description: "US 100 Tech Index", decimals: 2 },
};

type HistoricalResponse = {
  instrument: Instrument;
  timeframe: Timeframe;
  source: string;
  dateRange: string;
  count: number;
  candles: CandlestickData<Time>[];
  error?: string;
};

export default function TrainingPage() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [instrument, setInstrument] = useState<Instrument>("eurusd");
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionTime, setSessionTime] = useState<number | null>(null);
  const sessionTimeRef = useRef<number | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [lastPrice, setLastPrice] = useState("—");
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [error, setError] = useState("");
  const [candleCount, setCandleCount] = useState(0);
  const [dateRange, setDateRange] = useState("January 2025");
  const [retryCount, setRetryCount] = useState(0);

  const selectedInstrument = instrumentDetails[instrument];
  const sessionDateLabel = sessionTime === null
    ? "Selecting random session..."
    : new Date(sessionTime * 1000).toLocaleString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

  // Pick a random market once when a new training page is opened.
  // The state changes only on the client, so the server and first client render match.
  useEffect(() => {
    const markets = Object.keys(instrumentDetails) as Instrument[];
    const randomMarket = markets[Math.floor(Math.random() * markets.length)];
    setInstrument(randomMarket);
    setSessionReady(true);
  }, []);

  // Create the chart once. Data loading starts only after the chart is ready.
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 320),
      height: 520,
      layout: {
        background: { type: ColorType.Solid, color: "#080808" },
        textColor: "#a1a1aa",
        fontFamily: "Arial, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.045)" },
        horzLines: { color: "rgba(255,255,255,0.045)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.3)", width: 1, style: 2 },
        horzLine: { color: "rgba(255,255,255,0.3)", width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#ffffff",
      downColor: "#666666",
      borderUpColor: "#ffffff",
      borderDownColor: "#666666",
      wickUpColor: "#ffffff",
      wickDownColor: "#777777",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setChartReady(true);

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) chart.applyOptions({ width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setChartReady(false);
    };
  }, []);

  // Refit after React reveals the chart container. This avoids calculating
  // the initial viewport while the loading overlay is still being displayed.
  useEffect(() => {
    if (!hasData || !chartRef.current || !chartContainerRef.current) return;

    const frame = requestAnimationFrame(() => {
      const chart = chartRef.current;
      const container = chartContainerRef.current;
      if (!chart || !container) return;

      chart.applyOptions({
        width: Math.max(container.clientWidth, 320),
        height: 520,
      });
      chart.priceScale("right").applyOptions({ autoScale: true });
      chart.timeScale().fitContent();
    });

    return () => cancelAnimationFrame(frame);
  }, [hasData, candleCount]);

  useEffect(() => {
    if (!chartReady || !sessionReady || !seriesRef.current || !chartRef.current) return;

    const controller = new AbortController();
    setLoading(true);
    setHasData(false);
    setError("");
    setCandleCount(0);
    setLastPrice("—");
    seriesRef.current.setData([]);

    async function loadHistoricalData() {
      try {
        const response = await fetch(
          `/api/historical/${instrument}?timeframe=${timeframe}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const result = (await response.json()) as HistoricalResponse;

        if (!response.ok) {
          throw new Error(result.error ?? `Data request failed (${response.status}).`);
        }
        if (!Array.isArray(result.candles) || result.candles.length === 0) {
          throw new Error("No historical candles are available for this selection.");
        }

        const validCandles = result.candles.filter(
          (candle) =>
            Number.isFinite(Number(candle.time)) &&
            Number.isFinite(candle.open) &&
            Number.isFinite(candle.high) &&
            Number.isFinite(candle.low) &&
            Number.isFinite(candle.close),
        );
        if (validCandles.length === 0) {
          throw new Error("The data file did not contain valid chart candles.");
        }

        // The first H1 response determines the random historical point.
        // Subsequent timeframe changes reuse that exact timestamp.
        if (sessionTimeRef.current === null) {
          if (timeframe !== "H1") {
            throw new Error("The initial replay point could not be selected.");
          }
          const minIndex = Math.min(30, Math.max(0, validCandles.length - 2));
          const maxIndex = Math.max(minIndex + 1, Math.floor(validCandles.length * 0.9));
          const randomIndex = minIndex + Math.floor(Math.random() * (maxIndex - minIndex));
          sessionTimeRef.current = Number(validCandles[randomIndex].time);
          setSessionTime(sessionTimeRef.current);
        }

        const replayCandles = validCandles.filter(
          (candle) => Number(candle.time) <= (sessionTimeRef.current as number),
        );
        if (replayCandles.length === 0) {
          throw new Error("No candles exist before the selected replay point.");
        }

        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) {
          throw new Error("The chart is not ready yet.");
        }

        // Only historical candles up to the selected point reach the chart.
        series.setData(replayCandles);
        chart.priceScale("right").applyOptions({ autoScale: true });
        chart.timeScale().setVisibleLogicalRange({
          from: -1,
          to: replayCandles.length + 1,
        });
        chart.timeScale().fitContent();

        const lastCandle = replayCandles[replayCandles.length - 1];
        setLastPrice(lastCandle.close.toFixed(selectedInstrument.decimals));
        setCandleCount(replayCandles.length);
        setDateRange(result.dateRange || "Historical data");
        setHasData(true);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load historical data.");
        setHasData(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadHistoricalData();
    return () => controller.abort();
  }, [chartReady, sessionReady, instrument, timeframe, selectedInstrument.decimals, retryCount]);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="flex h-[70px] items-center justify-between border-b border-white/[0.08] px-5 md:px-8">
        <div className="flex items-center gap-4">
          <a href="/" aria-label="Back to dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/10 hover:text-white">
            <ArrowLeft size={18} />
          </a>
          <div>
            <h1 className="text-sm font-bold tracking-[0.16em]">URXO</h1>
            <p className="text-[9px] tracking-[0.2em] text-zinc-500">TRADING TERMINAL</p>
          </div>
          <div className="ml-4 hidden h-8 w-px bg-white/10 sm:block" />
          <div className="hidden sm:block">
            <p className="text-sm font-semibold">{selectedInstrument.label}</p>
            <p className="text-[10px] text-zinc-500">{selectedInstrument.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/10 px-3 py-2 text-[10px] tracking-wider text-zinc-400">HISTORICAL DATA</span>
          <button aria-label="Settings" className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10">
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4 md:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">Market / Historical Replay / {selectedInstrument.shortLabel}</p>
            <h2 className="mt-1 text-xl font-semibold">{selectedInstrument.label}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(instrumentDetails) as Instrument[]).map((key) => (
              <button key={key} onClick={() => setInstrument(key)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${instrument === key ? "border-white bg-white text-black" : "border-white/10 bg-[#111111] text-zinc-500 hover:text-white"}`}>
                {key === "eurusd" ? "EUR/USD" : key === "xauusd" ? "GOLD" : "NAS100"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111111] p-1">
            {(["D1", "H4", "H1"] as Timeframe[]).map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`rounded-lg px-5 py-2 text-xs font-semibold transition ${timeframe === tf ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0c]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
            <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-zinc-400" />
              <span className="text-xs font-semibold">Price Chart</span>
              <span className="text-[10px] text-zinc-600">{timeframe}</span>
              <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400">REPLAY · {sessionDateLabel}</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-500">
              <span className="text-xs">Last <span className="text-zinc-300">{lastPrice}</span></span>
              <button aria-label="Zoom out" onClick={() => chartRef.current?.timeScale().setVisibleLogicalRange({ from: 0, to: Math.max(candleCount * 0.65, 1) })} className="hover:text-white"><Minus size={15} /></button>
              <button aria-label="Zoom in" onClick={() => chartRef.current?.timeScale().fitContent()} className="hover:text-white"><Plus size={15} /></button>
              <button aria-label="Fit chart" onClick={() => chartRef.current?.timeScale().fitContent()} className="hover:text-white"><Maximize2 size={15} /></button>
            </div>
          </div>

          <div className="relative min-h-[520px] bg-[#080808]">
            <div ref={chartContainerRef} className={`absolute inset-0 w-full transition-opacity ${hasData ? "opacity-100" : "pointer-events-none opacity-0"}`} />
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#080808]">
                <LoaderCircle className="animate-spin text-zinc-300" size={30} />
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Loading historical data</p>
                  <p className="mt-1 text-xs text-zinc-500">{selectedInstrument.label} · {timeframe}</p>
                </div>
                <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-white/70" />
                </div>
              </div>
            )}
            {!loading && !hasData && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <BarChart3 size={32} className="text-zinc-600" />
                <p className="text-sm font-medium text-white">{error ? "Chart data could not be loaded" : "No chart data available"}</p>
                <p className="max-w-md text-xs text-zinc-500">{error || "There are no candles for this instrument and timeframe."}</p>
                <button onClick={() => setRetryCount((value) => value + 1)} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                  <RefreshCw size={14} /> Try again
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3">
            <span className="text-[10px] text-zinc-600">{selectedInstrument.shortLabel} · {timeframe} · Candlestick · {dateRange}</span>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span className={`h-1.5 w-1.5 rounded-full ${error ? "bg-red-400" : loading ? "bg-zinc-500" : hasData ? "bg-white" : "bg-zinc-600"}`} />
              {loading ? "Loading data" : error ? "Data error" : hasData ? "Data loaded" : "No data"}
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Instrument", value: selectedInstrument.label },
            { label: "Timeframe", value: timeframe },
            { label: "Data source", value: loading ? "Loading..." : hasData ? "Dukascopy CSV" : "Unavailable" },
            { label: "Historical period", value: dateRange },
            { label: "Replay start (UTC)", value: sessionTime === null ? "—" : sessionDateLabel },
            { label: "Candles on chart", value: loading ? "—" : String(candleCount) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/[0.08] bg-[#111111] p-5">
              <p className="text-xs text-zinc-500">{item.label}</p>
              <p className="mt-2 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

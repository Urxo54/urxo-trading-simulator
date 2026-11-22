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
  Maximize2,
  Minus,
  Plus,
  Settings2,
} from "lucide-react";

type Timeframe = "D1" | "H4" | "H1";
type Instrument = "eurusd" | "xauusd" | "usatechidxusd";

const instrumentDetails: Record<
  Instrument,
  { label: string; shortLabel: string; description: string; decimals: number }
> = {
  eurusd: {
    label: "EUR/USD",
    shortLabel: "EURUSD",
    description: "Euro / US Dollar",
    decimals: 5,
  },
  xauusd: {
    label: "Gold (XAU/USD)",
    shortLabel: "XAUUSD",
    description: "Gold / US Dollar",
    decimals: 2,
  },
  usatechidxusd: {
    label: "NAS100",
    shortLabel: "NAS100",
    description: "US 100 Tech Index",
    decimals: 2,
  },
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
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [lastPrice, setLastPrice] = useState("—");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [candleCount, setCandleCount] = useState(0);
  const [dateRange, setDateRange] = useState("January 2025");

  const selectedInstrument = instrumentDetails[instrument];

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
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
        vertLine: {
          color: "rgba(255,255,255,0.3)",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: "rgba(255,255,255,0.3)",
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
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

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      chart.applyOptions({ width: entries[0].contentRect.width });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistoricalData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/historical/${instrument}?timeframe=${timeframe}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const result = (await response.json()) as HistoricalResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Could not load historical data.");
        }

        if (!seriesRef.current || !chartRef.current) return;

        seriesRef.current.setData(result.candles);
        chartRef.current.timeScale().fitContent();

        const lastCandle = result.candles[result.candles.length - 1];
        setLastPrice(lastCandle.close.toFixed(selectedInstrument.decimals));
        setCandleCount(result.count);
        setDateRange(result.dateRange);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load historical data.",
        );
        setLastPrice("—");
        setCandleCount(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadHistoricalData();

    return () => controller.abort();
  }, [instrument, timeframe, selectedInstrument.decimals]);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="flex h-[70px] items-center justify-between border-b border-white/[0.08] px-5 md:px-8">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={18} />
          </a>

          <div>
            <h1 className="text-sm font-bold tracking-[0.16em]">URXO</h1>
            <p className="text-[9px] tracking-[0.2em] text-zinc-500">
              TRADING TERMINAL
            </p>
          </div>

          <div className="ml-4 hidden h-8 w-px bg-white/10 sm:block" />

          <div className="hidden sm:block">
            <p className="text-sm font-semibold">{selectedInstrument.label}</p>
            <p className="text-[10px] text-zinc-500">
              {selectedInstrument.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/10 px-3 py-2 text-[10px] tracking-wider text-zinc-400">
            HISTORICAL DATA
          </span>
          <button
            aria-label="Settings"
            className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10"
          >
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4 md:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">
              Market / Historical Replay / {selectedInstrument.shortLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {selectedInstrument.label}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(instrumentDetails) as Instrument[]).map((key) => (
              <button
                key={key}
                onClick={() => setInstrument(key)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  instrument === key
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-[#111111] text-zinc-500 hover:text-white"
                }`}
              >
                {key === "eurusd"
                  ? "EUR/USD"
                  : key === "xauusd"
                    ? "GOLD"
                    : "NAS100"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111111] p-1">
            {(["D1", "H4", "H1"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded-lg px-5 py-2 text-xs font-semibold transition ${
                  timeframe === tf
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
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
            </div>

            <div className="flex items-center gap-4 text-zinc-500">
              <span className="text-xs">
                Last <span className="text-zinc-300">{lastPrice}</span>
              </span>
              <button aria-label="Zoom out" className="hover:text-white">
                <Minus size={15} />
              </button>
              <button aria-label="Zoom in" className="hover:text-white">
                <Plus size={15} />
              </button>
              <button aria-label="Maximize chart" className="hover:text-white">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>

          <div className="p-2 md:p-4">
            <div ref={chartContainerRef} className="w-full" />
            {loading && (
              <p className="px-3 py-2 text-xs text-zinc-500">
                Loading historical candles...
              </p>
            )}
            {error && (
              <p className="px-3 py-2 text-xs text-red-400">{error}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3">
            <span className="text-[10px] text-zinc-600">
              {selectedInstrument.shortLabel} · {timeframe} · Candlestick ·{" "}
              {dateRange}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  error ? "bg-red-400" : loading ? "bg-zinc-500" : "bg-white"
                }`}
              />
              {error ? "Data error" : loading ? "Loading data" : "Data loaded"}
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Instrument", value: selectedInstrument.label },
            { label: "Timeframe", value: timeframe },
            {
              label: "Data source",
              value: loading ? "Loading..." : error ? "Unavailable" : "Dukascopy CSV",
            },
            { label: "Historical period", value: dateRange },
            { label: "Candles on chart", value: loading ? "—" : String(candleCount) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/[0.08] bg-[#111111] p-5"
            >
              <p className="text-xs text-zinc-500">{item.label}</p>
              <p className="mt-2 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

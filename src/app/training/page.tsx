
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
  ChevronDown,
  Maximize2,
  Minus,
  Plus,
  Settings2,
} from "lucide-react";

type Timeframe = "D1" | "H4" | "H1";

function generateCandles(timeframe: Timeframe): CandlestickData<Time>[] {
  const candles: CandlestickData<Time>[] = [];
  const now = Math.floor(Date.now() / 1000);
  const interval =
    timeframe === "D1" ? 86400 : timeframe === "H4" ? 14400 : 3600;

  let price = 1.085;

  for (let i = 100; i >= 0; i--) {
    const time = (now - i * interval) as Time;
    const open = price;
    const change = (Math.random() - 0.48) * 0.008;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 0.002;
    const low = Math.min(open, close) - Math.random() * 0.002;

    candles.push({
      time,
      open,
      high,
      low,
      close,
    });

    price = close;
  }

  return candles;
}

export default function TrainingPage() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [lastPrice, setLastPrice] = useState("1.08500");

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
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

    const candles = generateCandles(timeframe);
    series.setData(candles);

    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    setLastPrice(candles[candles.length - 1].close.toFixed(5));

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      chart.applyOptions({
        width: entries[0].contentRect.width,
      });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [timeframe]);

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
            <p className="text-sm font-semibold">EUR / USD</p>
            <p className="text-[10px] text-zinc-500">Euro / US Dollar</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/10 px-3 py-2 text-[10px] tracking-wider text-zinc-400">
            DEMO DATA
          </span>
          <button className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10">
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4 md:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">Market / Forex / EURUSD</p>
            <h2 className="mt-1 text-xl font-semibold">EUR/USD</h2>
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
                O <span className="text-zinc-300">{lastPrice}</span>
              </span>
              <button className="hover:text-white"><Minus size={15} /></button>
              <button className="hover:text-white"><Plus size={15} /></button>
              <button className="hover:text-white"><Maximize2 size={15} /></button>
            </div>
          </div>

          <div className="p-2 md:p-4">
            <div ref={chartContainerRef} className="w-full" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3">
            <span className="text-[10px] text-zinc-600">
              EURUSD · {timeframe} · Candlestick
            </span>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Chart engine active
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Instrument", value: "EUR / USD" },
            { label: "Timeframe", value: timeframe },
            { label: "Data source", value: "Demo candles" },
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

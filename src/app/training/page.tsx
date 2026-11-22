"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  FastForward,
  Rewind,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  MousePointer2,
  Minus as HorizontalLineIcon,
  TrendingUp,
  Square,
  Type,
  Undo2,
  Trash2,
} from "lucide-react";

type Timeframe = "D1" | "H4" | "H1";
type Instrument = "eurusd" | "xauusd" | "usatechidxusd";
type DrawingTool = "cursor" | "horizontal" | "line" | "trend" | "rectangle" | "text" | "delete";
type ChartPoint = { time: number; price: number };
type ChartMark =
  | { id: number; type: "horizontal" | "text"; a: ChartPoint; text?: string }
  | { id: number; type: "line" | "trend" | "rectangle"; a: ChartPoint; b: ChartPoint };

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCandles, setTotalCandles] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentReplayTime, setCurrentReplayTime] = useState<number | null>(null);
  const allCandlesRef = useRef<CandlestickData<Time>[]>([]);
  const replayIndexRef = useRef(-1);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("cursor");
  const [marks, setMarks] = useState<ChartMark[]>([]);
  const [pendingPoint, setPendingPoint] = useState<ChartPoint | null>(null);
  const [previewPoint, setPreviewPoint] = useState<ChartPoint | null>(null);
  const [selectedMarkId, setSelectedMarkId] = useState<number | null>(null);
  const dragRef = useRef<{ id: number; start: ChartPoint; original: ChartMark } | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);
  const nextMarkId = useRef(1);

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

  const currentReplayDateLabel = currentReplayTime === null
    ? "—"
    : new Date(currentReplayTime * 1000).toLocaleString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

  const revealCandlesAt = useCallback((requestedIndex: number) => {
    const candles = allCandlesRef.current;
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!candles.length || !series || !chart) return;

    const nextIndex = Math.max(0, Math.min(requestedIndex, candles.length - 1));
    const visibleCandles = candles.slice(0, nextIndex + 1);
    const lastCandle = visibleCandles[visibleCandles.length - 1];

    replayIndexRef.current = nextIndex;
    series.setData(visibleCandles);
    chart.timeScale().scrollToRealTime();
    setCurrentIndex(nextIndex);
    setCandleCount(visibleCandles.length);
    setLastPrice(lastCandle.close.toFixed(selectedInstrument.decimals));
    setCurrentReplayTime(Number(lastCandle.time));
  }, [selectedInstrument.decimals]);

  // Pick a random market once when a new training page is opened.
  // The state changes only on the client, so the server and first client render match.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const markets = Object.keys(instrumentDetails) as Instrument[];
      const randomMarket = markets[Math.floor(Math.random() * markets.length)];
      setInstrument(randomMarket);
      setSessionReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
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

    const refreshOverlay = () => setOverlayVersion((value) => value + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(refreshOverlay);
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) chart.applyOptions({ width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(refreshOverlay);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setChartReady(false);
    };
  }, []);

  // Fit the chart once when the first replay data becomes visible.
  // Do not refit after every candle: that would continuously change the zoom.
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
  }, [hasData]);

  useEffect(() => {
    if (!chartReady || !sessionReady || !seriesRef.current || !chartRef.current) return;

    const controller = new AbortController();
    setLoading(true);
    setHasData(false);
    setError("");
    setCandleCount(0);
    setLastPrice("—");
    setCurrentIndex(0);
    setTotalCandles(0);
    setCurrentReplayTime(null);
    setIsPlaying(false);
    setMarks([]);
    setPendingPoint(null);
    setPreviewPoint(null);
    setSelectedMarkId(null);
    dragRef.current = null;
    setDrawingTool("cursor");
    allCandlesRef.current = [];
    replayIndexRef.current = -1;
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

        let initialIndex = -1;
        for (let index = 0; index < validCandles.length; index += 1) {
          if (Number(validCandles[index].time) <= (sessionTimeRef.current as number)) {
            initialIndex = index;
          } else {
            break;
          }
        }
        if (initialIndex < 0) {
          throw new Error("No candles exist before the selected replay point.");
        }

        const replayCandles = validCandles.slice(0, initialIndex + 1);
        allCandlesRef.current = validCandles;
        replayIndexRef.current = initialIndex;
        setCurrentIndex(initialIndex);
        setTotalCandles(validCandles.length);
        setCurrentReplayTime(Number(replayCandles[replayCandles.length - 1].time));

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

  const pointFromPointer = (event: import("react").PointerEvent<HTMLDivElement>): ChartPoint | null => {
    const chart = chartRef.current; const series = seriesRef.current;
    if (!chart || !series) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left; const y = event.clientY - bounds.top;
    const time = chart.timeScale().coordinateToTime(x); const price = series.coordinateToPrice(y);
    return time === null || price === null || !Number.isFinite(price) ? null : { time: Number(time), price };
  };

  const markDistance = (mark: ChartMark, x: number, y: number) => {
    const chart = chartRef.current; const series = seriesRef.current;
    if (!chart || !series) return Infinity;
    const xy = (p: ChartPoint) => ({ x: chart.timeScale().timeToCoordinate(p.time as Time), y: series.priceToCoordinate(p.price) });
    const a = xy(mark.a); if (a.x === null || a.y === null) return Infinity;
    if (mark.type === "horizontal") return Math.abs(y-a.y);
    if (mark.type === "text") return Math.hypot(x-a.x,y-a.y);
    const b = xy(mark.b); if (b.x === null || b.y === null) return Infinity;
    if (mark.type === "trend") { const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/l)):0; return Math.hypot(x-a.x-t*dx,y-a.y-t*dy); }
    const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
    return x>=left&&x<=right&&y>=top&&y<=bottom ? 0 : Math.hypot(x-Math.max(left,Math.min(right,x)),y-Math.max(top,Math.min(bottom,y)));
  };

  const handleChartPointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const point=pointFromPointer(event); if(!point)return;
    const bounds=event.currentTarget.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
    if(drawingTool==="cursor"){
      let hit:ChartMark|null=null,dist=14; marks.forEach(m=>{const d=markDistance(m,x,y);if(d<dist){dist=d;hit=m;}});
      setSelectedMarkId(hit?.id??null); dragRef.current=hit?{id:hit.id,start:point,original:hit}:null;
      if(hit){chartRef.current?.applyOptions({handleScroll:false,handleScale:false});event.stopPropagation();event.preventDefault();}
      return;
    }
    if(drawingTool==="delete"){let hitId:number|null=null,dist=18;marks.forEach(m=>{const d=markDistance(m,x,y);if(d<dist){dist=d;hitId=m.id;}});if(hitId!==null)setMarks(v=>v.filter(m=>m.id!==hitId));setSelectedMarkId(null);return;}
    if(drawingTool==="horizontal"){setMarks(v=>[...v,{id:nextMarkId.current++,type:"horizontal",a:point}]);return;}
    if(drawingTool==="text"){const value=window.prompt("Текст заметки:");if(value?.trim())setMarks(v=>[...v,{id:nextMarkId.current++,type:"text",a:point,text:value.trim()}]);return;}
    if(!pendingPoint){setPendingPoint(point);setPreviewPoint(point);return;}
    setMarks(v=>[...v,{id:nextMarkId.current++,type:drawingTool,a:pendingPoint,b:point}]);setPendingPoint(null);setPreviewPoint(null);
  };

  const handleChartPointerMove = (event: import("react").PointerEvent<HTMLDivElement>) => {
    const point=pointFromPointer(event);if(!point)return;
    if(dragRef.current){chartRef.current?.setCrosshairPosition(point.price,point.time as Time,seriesRef.current!);const {id,start,original}=dragRef.current,dt=point.time-start.time,dp=point.price-start.price;
      setMarks(v=>v.map(m=>{if(m.id!==id)return m;const a={time:original.a.time+dt,price:original.a.price+dp};return "b" in original?{...original,a,b:{time:original.b.time+dt,price:original.b.price+dp}}:{...original,a};}));return;}
    if(pendingPoint)setPreviewPoint(point);
  };
  const handleChartPointerUp = () => { if(dragRef.current){dragRef.current=null;chartRef.current?.applyOptions({handleScroll:true,handleScale:true});chartRef.current?.clearCrosshairPosition();} };

  const toolButton = (tool: DrawingTool, label: string, Icon: typeof MousePointer2) => (
    <button key={tool} type="button" title={label} aria-label={label} onClick={() => {setDrawingTool(tool);setPendingPoint(null);setPreviewPoint(null);dragRef.current=null;}}
      className={`rounded-lg border p-2 transition ${drawingTool===tool?"border-white bg-white text-black":"border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"}`}><Icon size={16}/></button>
  );

  const drawingMarkup = (() => {
    const chart=chartRef.current,series=seriesRef.current;if(!chart||!series)return null;
    const xy=(p:ChartPoint)=>({x:chart.timeScale().timeToCoordinate(p.time as Time),y:series.priceToCoordinate(p.price)});
    const draw=(m:ChartMark,ghost=false)=>{const a=xy(m.a);if(a.x===null||a.y===null)return null;const active=m.id===selectedMarkId;
      if(m.type==="horizontal")return <g key={m.id}><line x1="0" x2="100%" y1={a.y} y2={a.y} stroke={active?"#fff":"#facc15"} strokeWidth={active?2.5:1.5} strokeDasharray="6 4"/><text x="8" y={a.y-6} fill={active?"#fff":"#facc15"} fontSize="11">{m.a.price.toFixed(selectedInstrument.decimals)}</text></g>;
      if(m.type==="text")return <text key={m.id} x={a.x+7} y={a.y-7} fill="white" fontSize="13" stroke="#080808" strokeWidth="3" paintOrder="stroke">{m.text}</text>;
      const b=xy(m.b);if(b.x===null||b.y===null)return null;
      if(m.type==="line"||m.type==="trend")return <line key={m.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active?"#fff":m.type==="line"?"#f472b6":"#60a5fa"} strokeWidth={active?3:2} strokeDasharray={ghost?"5 4":undefined}/>;
      return <rect key={m.id} x={Math.min(a.x,b.x)} y={Math.min(a.y,b.y)} width={Math.abs(b.x-a.x)} height={Math.abs(b.y-a.y)} fill="rgba(96,165,250,0.12)" stroke={active?"#fff":"#60a5fa"} strokeWidth={active?2.5:1.5} strokeDasharray={ghost?"5 4":undefined}/>;
    };
    const out=marks.map(m=>draw(m));
    if(pendingPoint&&previewPoint){const ghost:ChartMark=drawingTool==="line"?{id:-1,type:"line",a:pendingPoint,b:previewPoint}:drawingTool==="trend"?{id:-1,type:"trend",a:pendingPoint,b:previewPoint}:{id:-1,type:"rectangle",a:pendingPoint,b:previewPoint};out.push(draw(ghost,true));}
    return out;
  })();
  useEffect(() => {
    if (!isPlaying || !hasData) return;

    const timer = window.setInterval(() => {
      const nextIndex = replayIndexRef.current + 1;
      if (nextIndex >= allCandlesRef.current.length) {
        setIsPlaying(false);
        return;
      }
      revealCandlesAt(nextIndex);
    }, Math.max(50, 1000 / playbackSpeed));

    return () => window.clearInterval(timer);
  }, [isPlaying, hasData, playbackSpeed, revealCandlesAt]);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="flex h-[70px] items-center justify-between border-b border-white/[0.08] px-5 md:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="Back to dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/10 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
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
              <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400">REPLAY · {currentReplayDateLabel}</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-500">
              <span className="text-xs">Last <span className="text-zinc-300">{lastPrice}</span></span>
              <button aria-label="Zoom out" onClick={() => chartRef.current?.timeScale().setVisibleLogicalRange({ from: 0, to: Math.max(candleCount * 0.65, 1) })} className="hover:text-white"><Minus size={15} /></button>
              <button aria-label="Zoom in" onClick={() => chartRef.current?.timeScale().fitContent()} className="hover:text-white"><Plus size={15} /></button>
              <button aria-label="Fit chart" onClick={() => chartRef.current?.timeScale().fitContent()} className="hover:text-white"><Maximize2 size={15} /></button>
            </div>
          </div>

          <div className="relative min-h-[520px] bg-[#080808]">
            <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#111111]/95 p-1.5 shadow-xl">
              {toolButton("cursor", "Курсор", MousePointer2)}
              {toolButton("horizontal", "Горизонтальная линия", HorizontalLineIcon)}
              {toolButton("line", "Линия (от точки до точки)", Minus)}
              {toolButton("trend", "Трендовая линия", TrendingUp)}
              {toolButton("rectangle", "Прямоугольник", Square)}
              {toolButton("text", "Текстовая заметка", Type)}
              {toolButton("delete", "Удалить пометку", Trash2)}
              <span className="mx-1 w-px bg-white/10" />
              <button type="button" title="Отменить последнее действие" aria-label="Отменить последнее действие"
                onClick={() => { setMarks((current) => current.slice(0, -1)); setPendingPoint(null); setPreviewPoint(null); setSelectedMarkId(null); }}
                disabled={!marks.length && !pendingPoint}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10 disabled:opacity-30"><Undo2 size={16} /></button>
              <button type="button" title="Очистить все пометки" aria-label="Очистить все пометки"
                onClick={() => { setMarks([]); setPendingPoint(null); setPreviewPoint(null); setSelectedMarkId(null); }}
                disabled={!marks.length && !pendingPoint}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10 disabled:opacity-30"><Trash2 size={16} /></button>
            </div>
            {drawingTool !== "cursor" && <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-white/10 bg-[#111111]/90 px-3 py-2 text-[11px] text-zinc-300">{pendingPoint ? "Двигай мышь для размера · второй клик — зафиксировать" : "Первый клик — начальная точка"}</div>}
            <div ref={chartContainerRef} onPointerDownCapture={handleChartPointerDown} onPointerMove={handleChartPointerMove} onPointerUp={handleChartPointerUp} onPointerCancel={handleChartPointerUp} className={`absolute inset-0 w-full transition-opacity ${hasData ? "opacity-100" : "pointer-events-none opacity-0"}`} />
            {hasData && <svg key={overlayVersion} className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">{drawingMarkup}</svg>}
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

        <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-white">HISTORICAL REPLAY</p>
              <p className="mt-1 text-[11px] text-zinc-500">Свечи открываются постепенно — будущая история скрыта</p>
            </div>
            <span className="text-xs tabular-nums text-zinc-400">
              {totalCandles ? `${currentIndex + 1} / ${totalCandles}` : "—"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-label="Вернуться к первой свече"
              title="К первой свече"
              disabled={!hasData || currentIndex <= 0}
              onClick={() => revealCandlesAt(0)}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            ><SkipBack size={17} /></button>
            <button
              aria-label="Назад на 50 свечей"
              title="Назад на 50 свечей"
              disabled={!hasData || currentIndex <= 0}
              onClick={() => revealCandlesAt(currentIndex - 50)}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            ><Rewind size={17} /></button>
            <button
              aria-label="Предыдущая свеча"
              title="Предыдущая свеча"
              disabled={!hasData || currentIndex <= 0}
              onClick={() => revealCandlesAt(currentIndex - 1)}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            ><StepBack size={17} /></button>
            <button
              aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
              title={isPlaying ? "Пауза" : "Воспроизвести"}
              disabled={!hasData || currentIndex >= totalCandles - 1}
              onClick={() => setIsPlaying((value) => !value)}
              className="rounded-lg bg-white px-4 py-2 text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
            >{isPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
            <button
              aria-label="Следующая свеча"
              title="Следующая свеча"
              disabled={!hasData || currentIndex >= totalCandles - 1}
              onClick={() => revealCandlesAt(currentIndex + 1)}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            ><StepForward size={17} /></button>
            <button
              aria-label="Вперёд на 50 свечей"
              title="Вперёд на 50 свечей"
              disabled={!hasData || currentIndex >= totalCandles - 1}
              onClick={() => revealCandlesAt(currentIndex + 50)}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            ><FastForward size={17} /></button>
            <button
              aria-label="К последней свече"
              title="К последней свече"
              disabled={!hasData || currentIndex >= totalCandles - 1}
              onClick={() => { setIsPlaying(false); revealCandlesAt(totalCandles - 1); }}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            ><SkipForward size={17} /></button>

            <label className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500">
              Скорость
              <select
                value={playbackSpeed}
                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                className="rounded-lg border border-white/10 bg-[#151515] px-2 py-2 text-xs text-white outline-none"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
              </select>
            </label>
          </div>

          <div className="mt-5">
            <input
              aria-label="Позиция в исторических данных"
              type="range"
              min={0}
              max={Math.max(totalCandles - 1, 0)}
              value={Math.min(currentIndex, Math.max(totalCandles - 1, 0))}
              disabled={!hasData || totalCandles <= 1}
              onChange={(event) => { setIsPlaying(false); revealCandlesAt(Number(event.target.value)); }}
              className="w-full cursor-pointer accent-white disabled:cursor-not-allowed"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-zinc-500">
              <span>Начало истории</span>
              <span className="text-zinc-300">{currentReplayDateLabel}</span>
              <span>Конец истории</span>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {[
            { label: "Instrument", value: selectedInstrument.label },
            { label: "Timeframe", value: timeframe },
            { label: "Data source", value: loading ? "Loading..." : hasData ? "Dukascopy CSV" : "Unavailable" },
            { label: "Historical period", value: dateRange },
            { label: "Replay start (UTC)", value: sessionTime === null ? "—" : sessionDateLabel },
            { label: "Current replay (UTC)", value: currentReplayDateLabel },
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

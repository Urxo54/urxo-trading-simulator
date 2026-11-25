"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findFirstPriceTouch, findFirstTradeExit, positionRightEdgeIndex } from "@/lib/trading-replay";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Logical,
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
  Square,
  Type,
  Undo2,
  Trash2,
} from "lucide-react";

type Timeframe = "MN1" | "W1" | "D1" | "H4" | "H1";
type Instrument = "eurusd" | "xauusd" | "usatechidxusd";
type DrawingTool = "cursor" | "line" | "rectangle" | "text" | "delete";
type ChartPoint = { time: number; price: number };
type ChartMark =
  | { id: number; type: "text"; a: ChartPoint; text?: string }
  | { id: number; type: "line" | "rectangle"; a: ChartPoint; b: ChartPoint }
  | { id: number; type: "long" | "short"; a: ChartPoint; b: ChartPoint; tpPrice: number; orderType?: "market" | "pending"; createdIndex?: number; triggerIndex?: number; closedIndex?: number; pendingOriginalA?: ChartPoint; pendingOriginalB?: ChartPoint };

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

type ReviewSnapshot = { instrument: Instrument; timeframe: Timeframe; sessionTime: number; currentReplayTime: number; marks: ChartMark[]; tradeResult: "take-profit" | "stop-loss" };

export default function TrainingPage() {
  const router = useRouter();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [instrument, setInstrument] = useState<Instrument>("eurusd");
  const [reviewMode, setReviewMode] = useState(false);
  const reviewRestoreRef = useRef<ReviewSnapshot | null>(null);
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
  const [pendingReviewId, setPendingReviewId] = useState<number | null>(null);
  const [pendingIdeaPromptId, setPendingIdeaPromptId] = useState<number | null>(null);
  const [pendingCancelledPrompt, setPendingCancelledPrompt] = useState(false);
  const [reviewTakeProfit, setReviewTakeProfit] = useState("");
  const [reviewStopLoss, setReviewStopLoss] = useState("");
  const [tradeResult, setTradeResult] = useState<"take-profit" | "stop-loss" | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);
  const [currentReplayTime, setCurrentReplayTime] = useState<number | null>(null);
  const allCandlesRef = useRef<CandlestickData<Time>[]>([]);
  const replayIndexRef = useRef(-1);
  const playbackAnimationRef = useRef<number | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("cursor");
  const [marks, setMarks] = useState<ChartMark[]>([]);
  const [pendingPoint, setPendingPoint] = useState<ChartPoint | null>(null);
  const [previewPoint, setPreviewPoint] = useState<ChartPoint | null>(null);
  const [selectedMarkId, setSelectedMarkId] = useState<number | null>(null);
  const dragRef = useRef<{ id: number; mode: "move" | "move-vertical" | "resize-a" | "resize-b" | "resize-tp"; startX: number; startY: number; original: ChartMark } | null>(null);
  const [, setOverlayVersion] = useState(0);
  const nextMarkId = useRef(1);
  const drawingPrimitiveRequestRef = useRef<(() => void) | null>(null);
  const drawingStateRef = useRef({ marks, selectedMarkId, pendingPoint, previewPoint, drawingTool, candles: [] as CandlestickData<Time>[], currentIndex, timeframeSeconds: 3600, decimals: 5 });
  useEffect(() => {
    drawingStateRef.current = {
      marks,
      selectedMarkId,
      pendingPoint,
      previewPoint,
      drawingTool,
      candles: allCandlesRef.current,
      currentIndex,
      timeframeSeconds: timeframe === "MN1" ? 2592000 : timeframe === "W1" ? 604800 : timeframe === "D1" ? 86400 : timeframe === "H4" ? 14400 : 3600,
      decimals: instrumentDetails[instrument].decimals,
    };
  }, [marks, selectedMarkId, pendingPoint, previewPoint, drawingTool, currentIndex, timeframe, instrument]);

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

  const revealCandlesAt = useCallback((requestedIndex: number, animationDuration = 0) => {
    const candles = allCandlesRef.current;
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!candles.length || !series || !chart) return;

    let nextIndex = Math.max(0, Math.min(requestedIndex, candles.length - 1));
    let replayStopped = false;
    let closedTradeWasRewound = false;
    let rewoundPendingId: number | null = null;

    // Resolve the first trading event before revealing candles. This is
    // important for slider jumps and fast-forward: no candle after a fill/exit
    // may reach the chart in the same operation.
    const nextMarks: ChartMark[] = marks.map((mark): ChartMark => {
      if (mark.type !== "long" && mark.type !== "short") return mark;
      if (!mark.orderType) return mark;
      const isLong = mark.type === "long";

      if (mark.triggerIndex !== undefined && nextIndex < mark.triggerIndex) {
        rewoundPendingId = mark.id;
        return {
          ...mark,
          a: mark.pendingOriginalA ?? mark.a,
          b: mark.pendingOriginalB ?? mark.b,
          orderType: "pending" as const,
          triggerIndex: undefined,
          closedIndex: undefined,
          pendingOriginalA: undefined,
          pendingOriginalB: undefined,
        };
      }

      if (mark.closedIndex !== undefined && nextIndex < mark.closedIndex) {
        closedTradeWasRewound = true;
        return { ...mark, closedIndex: undefined };
      }

      if (mark.orderType === "pending" && mark.triggerIndex === undefined) {
        const first = Math.max((mark.createdIndex ?? 0) + 1, 0);
        const fillIndex = findFirstPriceTouch(candles, mark.a.price, first, requestedIndex);
        if (fillIndex === null) return mark;
        const fillCandle = candles[fillIndex];
        if (!fillCandle) return mark;
        nextIndex = Math.min(nextIndex, fillIndex);
        replayStopped = true;
        setPendingReviewId(mark.id);
        setReviewTakeProfit(String(mark.tpPrice));
        setReviewStopLoss(String(mark.b.price));
        const fillTime = Number(fillCandle.time);
        const rightIndex = positionRightEdgeIndex(fillIndex, fillIndex, candles.length);
        const initialRightTime = Number(candles[rightIndex]?.time ?? fillTime);
        return {
          ...mark,
          pendingOriginalA: mark.pendingOriginalA ?? mark.a,
          pendingOriginalB: mark.pendingOriginalB ?? mark.b,
          a: { ...mark.a, time: fillTime },
          b: { ...mark.b, time: initialRightTime },
          orderType: "market" as const,
          triggerIndex: fillIndex,
          closedIndex: undefined,
        };
      }

      if (mark.orderType === "market" && mark.triggerIndex !== undefined) {
        if (mark.closedIndex !== undefined) {
          const closedCandle = candles[mark.closedIndex];
          return closedCandle
            ? { ...mark, b: { ...mark.b, time: Number(closedCandle.time) } }
            : mark;
        }

        const exit = findFirstTradeExit(candles, {
          isLong,
          stopLoss: mark.b.price,
          takeProfit: mark.tpPrice,
        }, mark.triggerIndex + 1, requestedIndex);
        if (exit) {
          nextIndex = Math.min(nextIndex, exit.index);
          replayStopped = true;
          setTradeResult(exit.result);
          const exitCandle = candles[exit.index];
          return {
            ...mark,
            b: { ...mark.b, time: Number(exitCandle.time) },
            closedIndex: exit.index,
          };
        }
        const rightIndex = positionRightEdgeIndex(mark.triggerIndex, nextIndex, candles.length);
        const rightTime = Number(candles[rightIndex]?.time ?? mark.b.time);
        return { ...mark, b: { ...mark.b, time: rightTime } };
      }
      return mark;
    });

    if (rewoundPendingId !== null) {
      setPendingReviewId((current) => current === rewoundPendingId ? null : current);
      setReviewTakeProfit("");
      setReviewStopLoss("");
    }
    if (closedTradeWasRewound) setTradeResult(null);

    const visibleCandles = candles.slice(0, nextIndex + 1);
    const lastCandle = visibleCandles[visibleCandles.length - 1];
    replayIndexRef.current = nextIndex;
    series.setData(visibleCandles);

    // Preserve the user's current zoom while moving the replay window.
    const timeScale = chart.timeScale();
    const visibleRange = timeScale.getVisibleLogicalRange();
    const visibleWidth = visibleRange ? visibleRange.to - visibleRange.from : 100;
    const safeWidth = Number.isFinite(visibleWidth) && visibleWidth > 1 ? visibleWidth : 100;
    const rightOffset = safeWidth * 0.3;
    const targetRange = { from: nextIndex - safeWidth + rightOffset, to: nextIndex + rightOffset };

    const priceScale = chart.priceScale("right");
    const currentPriceRange = priceScale.getVisibleRange();
    const priceRangeHeight = currentPriceRange ? currentPriceRange.to - currentPriceRange.from : 0;
    const safePriceHeight = Number.isFinite(priceRangeHeight) && priceRangeHeight > 0 ? priceRangeHeight : 0;
    const priceMidpoint = currentPriceRange ? (currentPriceRange.from + currentPriceRange.to) / 2 : lastCandle.close;
    const shouldRecenter = Boolean(currentPriceRange && safePriceHeight > 0 && Math.abs(lastCandle.close - priceMidpoint) >= safePriceHeight * 0.25);
    const priceShift = shouldRecenter ? lastCandle.close - priceMidpoint : 0;
    const targetPriceRange = currentPriceRange ? { from: currentPriceRange.from + priceShift, to: currentPriceRange.to + priceShift } : null;

    if (playbackAnimationRef.current !== null) {
      window.cancelAnimationFrame(playbackAnimationRef.current);
      playbackAnimationRef.current = null;
    }
    if (animationDuration > 0 && visibleRange && currentPriceRange) {
      const startRange = { from: visibleRange.from, to: visibleRange.to };
      const startPriceRange = { from: currentPriceRange.from, to: currentPriceRange.to };
      let animationStart: number | null = null;
      const animate = (timestamp: number) => {
        if (animationStart === null) animationStart = timestamp;
        const progress = Math.min(1, (timestamp - animationStart) / animationDuration);
        timeScale.setVisibleLogicalRange({
          from: startRange.from + (targetRange.from - startRange.from) * progress,
          to: startRange.to + (targetRange.to - startRange.to) * progress,
        });
        if (shouldRecenter && targetPriceRange) {
          priceScale.setVisibleRange({
            from: startPriceRange.from + (targetPriceRange.from - startPriceRange.from) * progress,
            to: startPriceRange.to + (targetPriceRange.to - startPriceRange.to) * progress,
          });
        }
        if (progress < 1) playbackAnimationRef.current = window.requestAnimationFrame(animate);
        else playbackAnimationRef.current = null;
      };
      playbackAnimationRef.current = window.requestAnimationFrame(animate);
    } else {
      timeScale.setVisibleLogicalRange(targetRange);
      if (shouldRecenter && targetPriceRange) priceScale.setVisibleRange(targetPriceRange);
    }

    setCurrentIndex(nextIndex);
    setCandleCount(visibleCandles.length);
    setLastPrice(lastCandle.close.toFixed(selectedInstrument.decimals));
    setCurrentReplayTime(Number(lastCandle.time));
    setMarks(nextMarks);
    if (replayStopped) setIsPlaying(false);
  }, [selectedInstrument.decimals, marks, pendingReviewId]);

  // Restore a completed trade when opening analysis mode.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "review") {
      try {
        const raw = window.sessionStorage.getItem("urxo-trade-review");
        const snapshot = raw ? JSON.parse(raw) as ReviewSnapshot : null;
        if (snapshot && snapshot.instrument in instrumentDetails && snapshot.timeframe) {
          const frame = window.requestAnimationFrame(() => {
            reviewRestoreRef.current = snapshot;
            sessionTimeRef.current = snapshot.sessionTime;
            setInstrument(snapshot.instrument);
            setTimeframe(snapshot.timeframe);
            setSessionTime(snapshot.sessionTime);
            setMarks(snapshot.marks);
            setTradeResult(snapshot.tradeResult);
            setReviewMode(true);
            setSessionReady(true);
          });
          return () => window.cancelAnimationFrame(frame);
        }
      } catch {
        window.sessionStorage.removeItem("urxo-trade-review");
      }
    }
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
    const getDrawingX = (time: number): number | null => {
      const state = drawingStateRef.current, candles = state.candles, last = candles[state.currentIndex];
      if (!last) return null;
      let logical: number;
      if (time >= Number(last.time)) logical = state.currentIndex + (time - Number(last.time)) / state.timeframeSeconds;
      else { let low = 0, high = Math.min(state.currentIndex, candles.length - 1); while (low < high) { const mid = Math.floor((low + high) / 2); if (Number(candles[mid].time) < time) low = mid + 1; else high = mid; } const right = low; if (right === 0) logical = 0; else { const left = right - 1, span = Number(candles[right].time) - Number(candles[left].time); logical = left + (span ? (time - Number(candles[left].time)) / span : 0); } }
      return chart.timeScale().logicalToCoordinate(logical as Logical);
    };
    type RenderMark = { mark: ChartMark; a: { x: number; y: number }; b?: { x: number; y: number }; handles?: { a?: { x: number; y: number }; b?: { x: number; y: number }; tp?: { x: number; y: number } }; active: boolean; ghost: boolean };
    let renderedMarks: RenderMark[] = [];
    const drawingRenderer = {
      draw: (target: { useMediaCoordinateSpace: (callback: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => void) => void }) => {
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          context.save();
          context.beginPath();
          context.rect(0, 0, mediaSize.width, mediaSize.height);
          context.clip();
          for (const item of renderedMarks) {
            const { mark, a, b, active, ghost } = item;
            context.save();
            context.lineWidth = active ? 2.5 : 1.5;
            context.strokeStyle = active ? "#ffffff" : mark.type === "rectangle" ? "#60a5fa" : mark.type === "long" ? "#22c55e" : mark.type === "short" ? "#ef4444" : "#f472b6";
            if (ghost) context.setLineDash([5, 4]);
            if (mark.type === "text") {
              context.font = "13px Arial"; context.lineWidth = 3; context.strokeStyle = "#080808"; context.strokeText(mark.text ?? "", a.x + 7, a.y - 7);
              context.fillStyle = "#ffffff"; context.fillText(mark.text ?? "", a.x + 7, a.y - 7);
            } else if (b) {
              context.beginPath();
              if (mark.type === "line") { context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke(); }
              else if (mark.type === "rectangle") { const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y), width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y); context.fillStyle = "rgba(96,165,250,0.12)"; context.fillRect(left, top, width, height); context.strokeRect(left, top, width, height); }
              else if (mark.type === "long" || mark.type === "short") {
                const isLong = mark.type === "long";
                const targetPrice = mark.tpPrice;
                const targetY = series.priceToCoordinate(targetPrice);
                if (targetY !== null) {
                  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), width = Math.max(1, right - left);
                  const stopY = series.priceToCoordinate(mark.b.price) ?? b.y;
                  const profitTop = Math.min(a.y, targetY), profitBottom = Math.max(a.y, targetY);
                  const riskTop = Math.min(a.y, stopY), riskBottom = Math.max(a.y, stopY);
                  context.fillStyle = "rgba(255,255,255,0.10)"; context.fillRect(left, profitTop, width, Math.max(1, profitBottom - profitTop));
                  context.fillStyle = "rgba(0,0,0,0.45)"; context.fillRect(left, riskTop, width, Math.max(1, riskBottom - riskTop));
                  context.strokeStyle = isLong ? "#ffffff" : "#000000";
                  context.beginPath(); context.moveTo(left, a.y); context.lineTo(right, a.y); context.stroke();
                  context.beginPath(); context.setLineDash([5, 4]); context.moveTo(left, targetY); context.lineTo(right, targetY); context.moveTo(left, stopY); context.lineTo(right, stopY); context.stroke(); context.setLineDash([]);
                  context.font = "11px Arial"; context.fillStyle = "#ffffff"; context.fillText("orderType" in mark && mark.orderType === "pending" ? (isLong ? "PENDING BUY" : "PENDING SELL") : "orderType" in mark && mark.orderType === "market" ? (isLong ? "LONG · OPEN" : "SHORT · OPEN") : (isLong ? "LONG" : "SHORT"), left + 5, profitTop + 13);
                }
              }
            }
            context.restore();
            if (item.handles) {
              const drawHandle = (point: { x: number; y: number }) => {
                context.beginPath();
                context.arc(point.x < 0 ? mediaSize.width - 28 : point.x, point.y, 5, 0, Math.PI * 2);
                context.fillStyle = "#080808"; context.fill();
                context.lineWidth = 2; context.strokeStyle = "#ffffff"; context.stroke();
              };
              if (item.handles.a) drawHandle(item.handles.a);
              if (item.handles.b) drawHandle(item.handles.b);
              if (item.handles.tp) drawHandle(item.handles.tp);
            }
          }
          context.restore();
        });
      },
    };
    const drawingPaneView = { renderer: () => drawingRenderer, zOrder: () => "top" as const };
    const drawingPrimitive = {
      attached: (params: { requestUpdate?: () => void }) => { drawingPrimitiveRequestRef.current = params.requestUpdate ?? null; },
      detached: () => { drawingPrimitiveRequestRef.current = null; renderedMarks = []; },
      updateAllViews: () => {
        const state = drawingStateRef.current;
        const toXY = (point: ChartPoint) => {
          const x = getDrawingX(point.time), y = series.priceToCoordinate(point.price);
          return x === null || y === null ? null : { x, y };
        };
        const next: RenderMark[] = [];
        const add = (mark: ChartMark, ghost = false) => {
          const a = toXY(mark.a);
          if (!a) return;
          const b = "b" in mark ? toXY(mark.b) ?? undefined : undefined;
          if ("b" in mark && !b) return;
          next.push({ mark, a, b, active: mark.id === state.selectedMarkId, ghost });
        };
        state.marks.forEach((mark) => add(mark));
        if (state.pendingPoint && state.previewPoint) {
          if (state.drawingTool === "line") {
            add({ id: -1, type: "line", a: state.pendingPoint, b: state.previewPoint }, true);
          } else {
            add({ id: -1, type: "rectangle", a: state.pendingPoint, b: state.previewPoint }, true);
          }
        }
        const selected = state.marks.find((mark) => mark.id === state.selectedMarkId);
        if (selected) {
          const a = toXY(selected.a);
          const b = "b" in selected ? toXY(selected.b) : null;
          const item = next.find((entry) => entry.mark.id === selected.id);
          if (item && a) {
            const isPosition = selected.type === "long" || selected.type === "short";
            const tp = "tpPrice" in selected ? series.priceToCoordinate(selected.tpPrice) : null;
            item.handles = {
              a: isPosition && "orderType" in selected && selected.orderType === "market" ? undefined : a,
              b: b ?? undefined,
              tp: tp !== null && b ? { x: b.x, y: tp } : undefined,
            };
          }
        }
        renderedMarks = next;
      },
      paneViews: () => [drawingPaneView],
    };
    series.attachPrimitive(drawingPrimitive as never);
    setChartReady(true);
    const refreshOverlay=()=>{setOverlayVersion((value)=>value+1);drawingPrimitiveRequestRef.current?.();};
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
      const replayIndex = replayIndexRef.current;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(-1, replayIndex - 70),
        to: replayIndex + 30,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [hasData]);

  useEffect(() => {
    if (!chartReady || !sessionReady || !seriesRef.current || !chartRef.current) return;

    const controller = new AbortController();

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
        const restoreTime = reviewRestoreRef.current?.currentReplayTime;
        const targetTime = reviewMode && restoreTime ? restoreTime : (sessionTimeRef.current as number);
        for (let index = 0; index < validCandles.length; index += 1) {
          if (Number(validCandles[index].time) <= targetTime) {
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
          from: Math.max(-1, initialIndex - 70),
          to: initialIndex + 30,
        });

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

    const resetFrame = window.requestAnimationFrame(() => {
      setLoading(true);
      setHasData(false);
      setError("");
      setCandleCount(0);
      setLastPrice("—");
      setCurrentIndex(0);
      setTotalCandles(0);
      setCurrentReplayTime(null);
      setIsPlaying(false);
      setPendingReviewId(null);
      setPendingIdeaPromptId(null);
      if (!reviewMode) setTradeResult(null);
      setPendingPoint(null);
      setPreviewPoint(null);
      setSelectedMarkId(null);
      dragRef.current = null;
      setDrawingTool("cursor");
      allCandlesRef.current = [];
      replayIndexRef.current = -1;
      seriesRef.current?.setData([]);
      void loadHistoricalData();
    });
    return () => {
      window.cancelAnimationFrame(resetFrame);
      controller.abort();
    };
  }, [chartReady, sessionReady, instrument, timeframe, selectedInstrument.decimals, retryCount, reviewMode]);

  useEffect(() => { drawingPrimitiveRequestRef.current?.(); }, [marks, selectedMarkId, pendingPoint, previewPoint, drawingTool, currentIndex, timeframe, instrument]);

  const timeframeSeconds = timeframe === "MN1" ? 2592000 : timeframe === "W1" ? 604800 : timeframe === "D1" ? 86400 : timeframe === "H4" ? 14400 : 3600;

  // Convert between chart coordinates and market time. Logical coordinates let
  // drawings extend into the empty space after the last revealed candle.
  const pointFromCoordinates = (x: number, y: number): ChartPoint | null => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    if (logical === null || price === null || !Number.isFinite(price)) return null;

    const candles = allCandlesRef.current;
    const lastCandle = candles[currentIndex];
    if (!candles.length || !lastCandle) return null;

    // Future drawing space is measured from the last revealed candle, not
    // from hidden historical data. This mirrors getDrawingX exactly.
    let time: number;
    if (logical >= currentIndex) {
      time = Number(lastCandle.time) + (logical - currentIndex) * timeframeSeconds;
    } else {
      const left = Math.max(0, Math.min(currentIndex, Math.floor(logical)));
      const right = Math.min(currentIndex, left + 1);
      const fraction = logical - left;
      if (right > left) {
        time = Number(candles[left].time) +
          (Number(candles[right].time) - Number(candles[left].time)) * fraction;
      } else {
        const previous = candles[Math.max(0, left - 1)];
        const span = left > 0
          ? Number(candles[left].time) - Number(previous.time)
          : timeframeSeconds;
        time = Number(candles[left].time) + (logical - left) * span;
      }
    }
    return { time, price };
  };

  const pointFromPointer = (event: import("react").PointerEvent<HTMLDivElement>): ChartPoint | null => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return pointFromCoordinates(event.clientX - bounds.left, event.clientY - bounds.top);
  };

  const coordinateForTime = (time: number): number | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const candles = allCandlesRef.current;
    const lastCandle = candles[currentIndex];
    if (!candles.length || !lastCandle) return null;

    let logical: number;
    // Keep future marks in the same replay-relative coordinate system used
    // by the primitive renderer, even when hidden candles exist in memory.
    if (time >= Number(lastCandle.time)) {
      logical = currentIndex + (time - Number(lastCandle.time)) / timeframeSeconds;
    } else {
      let low = 0;
      let high = currentIndex;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (Number(candles[mid].time) < time) low = mid + 1;
        else high = mid;
      }
      const right = low;
      if (right === 0) {
        const span = currentIndex > 0
          ? Number(candles[1].time) - Number(candles[0].time)
          : timeframeSeconds;
        logical = (time - Number(candles[0].time)) / span;
      } else {
        const left = right - 1;
        const span = Number(candles[right].time) - Number(candles[left].time);
        const fraction = span ? (time - Number(candles[left].time)) / span : 0;
        logical = left + fraction;
      }
    }
    return chart.timeScale().logicalToCoordinate(logical as Logical);
  };

  const snapLinePoint = (origin: ChartPoint, target: ChartPoint): ChartPoint => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return target;
    const x1 = coordinateForTime(origin.time);
    const y1 = series.priceToCoordinate(origin.price);
    const x2 = coordinateForTime(target.time);
    const y2 = series.priceToCoordinate(target.price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return target;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    return pointFromCoordinates(x1 + Math.cos(snappedAngle) * distance, y1 + Math.sin(snappedAngle) * distance) ?? target;
  };

  const markDistance = (mark: ChartMark, x: number, y: number) => {
    const chart = chartRef.current; const series = seriesRef.current;
    if (!chart || !series) return Infinity;
    const xy = (p: ChartPoint) => ({ x: coordinateForTime(p.time), y: series.priceToCoordinate(p.price) });
    const a = xy(mark.a); if (a.x === null || a.y === null) return Infinity;
    if (mark.type === "text") return Math.hypot(x-a.x,y-a.y);
    const b = xy(mark.b); if (b.x === null || b.y === null) return Infinity;
    if (mark.type === "line") { const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/l)):0; return Math.hypot(x-a.x-t*dx,y-a.y-t*dy); }
    let top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
    if (mark.type === "long" || mark.type === "short") {
      const tpY = series.priceToCoordinate(mark.tpPrice);
      if (tpY !== null) {
        if (Math.abs(x - b.x) <= 10 && Math.abs(y - tpY) <= 10) return 0;
        top = Math.min(top, tpY);
        bottom = Math.max(bottom, tpY);
      }
    }
    const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x);
    return x>=left&&x<=right&&y>=top&&y<=bottom ? 0 : Math.hypot(x-Math.max(left,Math.min(right,x)),y-Math.max(top,Math.min(bottom,y)));
  };

  const handleChartPointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if (reviewMode) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const point = pointFromPointer(event);
    if (!point) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;

    if (drawingTool === "cursor") {
      const series = seriesRef.current;
      let hit: ChartMark | null = null;
      let mode: "move" | "move-vertical" | "resize-a" | "resize-b" | "resize-tp" = "move";

      // Detect editable position handles on every order, not only the
      // previously selected one. This makes handles work on first click.
      if (series) {
        for (let i = marks.length - 1; i >= 0; i -= 1) {
          const candidate = marks[i];
          if (candidate.type !== "long" && candidate.type !== "short") continue;
          const ax = coordinateForTime(candidate.a.time);
          const ay = series.priceToCoordinate(candidate.a.price);
          const bx = coordinateForTime(candidate.b.time);
          const by = series.priceToCoordinate(candidate.b.price);
          const tpY = series.priceToCoordinate(candidate.tpPrice);
          if (ax === null || ay === null || bx === null || by === null || tpY === null) continue;

          if (Math.hypot(x - bx, y - tpY) <= 14) {
            hit = candidate;
            mode = "resize-tp";
            break;
          }
          if (Math.hypot(x - bx, y - by) <= 14) {
            hit = candidate;
            mode = "resize-b";
            break;
          }
          if (candidate.orderType === "pending" && Math.hypot(x - ax, y - ay) <= 14) {
            hit = candidate;
            mode = "resize-a";
            break;
          }
        }
      }

      // If no handle was hit, find the drawing/order body under the pointer.
      if (!hit) {
        let nearest = 14;
        for (let i = marks.length - 1; i >= 0; i -= 1) {
          const candidate = marks[i];
          const distance = markDistance(candidate, x, y);
          if (distance < nearest) {
            nearest = distance;
            hit = candidate;
          }
        }
        if (hit && (hit.type === "long" || hit.type === "short")) {
          mode = hit.orderType === "pending" ? "move-vertical" : "move";
        }
      }

      setSelectedMarkId(hit?.id ?? null);
      const lockedMarketBody = Boolean(
        hit && (hit.type === "long" || hit.type === "short") &&
        hit.orderType === "market" && mode === "move"
      );
      dragRef.current = hit && !lockedMarketBody
        ? { id: hit.id, mode, startX: x, startY: y, original: hit }
        : null;

      if (hit) {
        chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
        event.stopPropagation();
        event.preventDefault();
      }
      return;
    }

    if (drawingTool === "delete") {
      let hitId: number | null = null;
      let nearest = 18;
      marks.forEach((mark) => {
        const distance = markDistance(mark, x, y);
        if (distance < nearest) {
          nearest = distance;
          hitId = mark.id;
        }
      });
      if (hitId !== null) setMarks((current) => current.filter((mark) => mark.id !== hitId));
      setSelectedMarkId(null);
      return;
    }
    if (drawingTool === "text") {
      const value = window.prompt("Текст заметки:");
      if (value?.trim()) {
        const id = nextMarkId.current++;
        setMarks((current) => [...current, { id, type: "text", a: point, text: value.trim() }]);
        setSelectedMarkId(id);
      }
      setDrawingTool("cursor");
      return;
    }
    if (!pendingPoint) {
      setPendingPoint(point);
      setPreviewPoint(point);
      return;
    }
    const finalPoint = drawingTool === "line" && event.shiftKey
      ? snapLinePoint(pendingPoint, point)
      : point;
    const id = nextMarkId.current++;
    setMarks((current) => [...current, { id, type: drawingTool, a: pendingPoint, b: finalPoint } as ChartMark]);
    setSelectedMarkId(id);
    setPendingPoint(null);
    setPreviewPoint(null);
    setDrawingTool("cursor");
  };

  const handleChartPointerMove = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if (reviewMode) return;
    setOverlayVersion((value) => value + 1);
    const point = pointFromPointer(event);
    if (!point) return;

    if (dragRef.current) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const { id, mode, startX, startY, original } = dragRef.current;
      let updated: ChartMark;

      if (mode === "resize-a" && (original.type === "long" || original.type === "short") && original.orderType === "pending") {
        // A pending order's entry handle changes price only; its time stays fixed.
        updated = { ...original, a: { ...original.a, price: point.price } };
      } else if (mode === "resize-a") {
        updated = { ...original, a: point } as ChartMark;
      } else if (mode === "resize-tp" && (original.type === "long" || original.type === "short")) {
        updated = { ...original, tpPrice: point.price };
      } else if (mode === "resize-b" && "b" in original) {
        updated = "tpPrice" in original
          ? { ...original, b: { ...original.b, price: point.price } }
          : { ...original, b: point };
      } else if (mode === "move-vertical" && (original.type === "long" || original.type === "short")) {
        const series = seriesRef.current;
        const startPrice = series?.coordinateToPrice(startY);
        if (startPrice === null || startPrice === undefined) return;
        const priceDelta = point.price - startPrice;
        updated = {
          ...original,
          a: { ...original.a, price: original.a.price + priceDelta },
          b: { ...original.b, price: original.b.price + priceDelta },
          tpPrice: original.tpPrice + priceDelta,
        };
      } else if ("b" in original) {
        const originalAX = coordinateForTime(original.a.time);
        const originalAY = seriesRef.current?.priceToCoordinate(original.a.price) ?? null;
        const originalBX = coordinateForTime(original.b.time);
        const originalBY = seriesRef.current?.priceToCoordinate(original.b.price) ?? null;
        if (originalAX === null || originalAY === null || originalBX === null || originalBY === null) return;
        const dx = x - startX;
        const dy = y - startY;
        const movedA = pointFromCoordinates(originalAX + dx, originalAY + dy);
        const movedB = pointFromCoordinates(originalBX + dx, originalBY + dy);
        if (!movedA || !movedB) return;
        if ("tpPrice" in original) {
          const originalTpY = seriesRef.current?.priceToCoordinate(original.tpPrice) ?? null;
          const movedTp = originalTpY === null ? null : pointFromCoordinates(originalBX + dx, originalTpY + dy);
          if (!movedTp) return;
          updated = { ...original, a: movedA, b: movedB, tpPrice: movedTp.price };
        } else {
          updated = { ...original, a: movedA, b: movedB };
        }
      } else {
        const originalAX = coordinateForTime(original.a.time);
        const originalAY = seriesRef.current?.priceToCoordinate(original.a.price) ?? null;
        if (originalAX === null || originalAY === null) return;
        const movedA = pointFromCoordinates(originalAX + (x - startX), originalAY + (y - startY));
        if (!movedA) return;
        updated = { ...original, a: movedA } as ChartMark;
      }

      if (seriesRef.current) {
        chartRef.current?.setCrosshairPosition(point.price, point.time as Time, seriesRef.current);
      }
      setMarks((current) => current.map((mark) => mark.id === id ? updated : mark));
      return;
    }
    if (pendingPoint) {
      setPreviewPoint(drawingTool === "line" && event.shiftKey
        ? snapLinePoint(pendingPoint, point)
        : point);
    }
  };

  const handleChartPointerUp = () => { if (reviewMode) return; if(dragRef.current){dragRef.current=null;chartRef.current?.applyOptions({handleScroll:true,handleScale:true});chartRef.current?.clearCrosshairPosition();} };

  const createPosition = (direction: "long" | "short", orderType: "market" | "pending") => {
    const candle = allCandlesRef.current[currentIndex];
    if (!candle) return;
    const entry = Number(candle.close);
    const range = chartRef.current?.priceScale("right").getVisibleRange();
    const visibleHeight = range ? Math.abs(range.to - range.from) : Math.abs(entry) * 0.02;
    const risk = Math.max(visibleHeight * 0.06, Math.abs(entry) * 0.0001);
    const isLong = direction === "long";
    const timeframeSeconds = timeframe === "MN1" ? 2592000 : timeframe === "W1" ? 604800 : timeframe === "D1" ? 86400 : timeframe === "H4" ? 14400 : 3600;
    const id = nextMarkId.current++;
    const mark: ChartMark = {
      id,
      type: direction,
      a: { time: Number(candle.time), price: entry },
      b: { time: Number(candle.time) + timeframeSeconds * 20, price: entry + (isLong ? -risk : risk) },
      tpPrice: entry + (isLong ? risk : -risk),
      orderType,
      createdIndex: currentIndex,
      triggerIndex: orderType === "market" ? currentIndex : undefined,
    };
    setMarks((current) => [...current, mark]);
    setSelectedMarkId(id);
    setDrawingTool("cursor");
    setPendingPoint(null);
    setPreviewPoint(null);
  };

  const confirmPendingReview = () => {
    if (pendingReviewId === null) return;
    const tp = Number(reviewTakeProfit);
    const sl = Number(reviewStopLoss);
    if (!Number.isFinite(tp) || !Number.isFinite(sl)) return;
    setMarks((current) => current.map((mark) =>
      mark.id === pendingReviewId && (mark.type === "long" || mark.type === "short")
        ? { ...mark, tpPrice: tp, b: { ...mark.b, price: sl } }
        : mark
    ));
    setPendingReviewId(null);
  };

  const continueAfterReview = () => { setPendingReviewId(null); setIsPlaying(true); };

  const continuePendingIdea = () => {
    setPendingIdeaPromptId(null);
    setIsPlaying(true);
  };

  const cancelPendingIdea = () => {
    if (pendingIdeaPromptId === null) return;
    setMarks((current) => current.filter((mark) => mark.id !== pendingIdeaPromptId));
    setSelectedMarkId(null);
    setPendingIdeaPromptId(null);
    setIsPlaying(false);
    setPendingCancelledPrompt(true);
  };

  const skipCurrentChart = () => {
    setIsPlaying(false);
    router.push("/training");
  };

  const toolButton = (tool: DrawingTool, label: string, Icon: typeof MousePointer2) => (
    <button key={tool} type="button" title={label} aria-label={label} onClick={() => {setDrawingTool(tool);setPendingPoint(null);setPreviewPoint(null);dragRef.current=null;}}
      className={`rounded-lg border p-2 transition ${drawingTool===tool?"border-white bg-white text-black":"border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"}`}><Icon size={16}/></button>
  );

  const pendingOrderId = marks.find((mark) =>
    (mark.type === "long" || mark.type === "short") && mark.orderType === "pending"
  )?.id ?? null;

  useEffect(() => {
    if (!isPlaying || pendingOrderId === null || reviewMode || pendingReviewId !== null || pendingIdeaPromptId !== null || tradeResult !== null) return;

    // The reminder countdown runs only while replay is playing.
    // Candle updates do not reset it; pausing playback cancels the countdown.
    const timeout = window.setTimeout(() => {
      setIsPlaying(false);
      setPendingIdeaPromptId(pendingOrderId);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [isPlaying, pendingOrderId, reviewMode, pendingReviewId, pendingIdeaPromptId, tradeResult]);

  useEffect(() => {
    if (!isPlaying || !hasData) return;

    const intervalMs = Math.max(50, 1000 / playbackSpeed);
    const timer = window.setInterval(() => {
      const nextIndex = replayIndexRef.current + 1;
      if (nextIndex >= allCandlesRef.current.length) {
        setIsPlaying(false);
        return;
      }
      // Animate most of each candle interval; leave a small pause at the end
      // so every playback speed remains visually distinct and stable.
      revealCandlesAt(nextIndex, intervalMs * 0.85);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
      if (playbackAnimationRef.current !== null) {
        window.cancelAnimationFrame(playbackAnimationRef.current);
        playbackAnimationRef.current = null;
      }
    };
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
          <span className="rounded-lg border border-white/10 px-3 py-2 text-[10px] tracking-wider text-zinc-400">{reviewMode ? "TRADE ANALYSIS" : "HISTORICAL DATA"}</span>
          <button aria-label="Settings" className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10">
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4 md:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">Market / {reviewMode ? "Trade Analysis" : "Historical Replay"} / {selectedInstrument.shortLabel}</p>
            <h2 className="mt-1 text-xl font-semibold">{reviewMode ? "Разбор завершённой сделки" : selectedInstrument.label}</h2>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111111] p-1">
            {(["MN1", "W1", "D1", "H4", "H1"] as Timeframe[]).map((tf) => (
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
            {!reviewMode && <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#111111]/95 p-1.5 shadow-xl">
              {toolButton("cursor", "Курсор", MousePointer2)}
              {toolButton("line", "Линия (от точки до точки)", Minus)}
              {toolButton("rectangle", "Прямоугольник", Square)}
              {toolButton("text", "Текстовая заметка", Type)}
              {toolButton("delete", "Удалить пометку", Trash2)}
              <span className="mx-1 w-px bg-white/10" />
              <button type="button" title="Buy Market" onClick={() => createPosition("long", "market")} disabled={!hasData} className="rounded-lg border border-white/20 px-2 py-2 text-[10px] font-bold text-white hover:bg-white/15 disabled:opacity-30">BUY MKT</button>
              <button type="button" title="Sell Market" onClick={() => createPosition("short", "market")} disabled={!hasData} className="rounded-lg border border-white/20 px-2 py-2 text-[10px] font-bold text-white hover:bg-white/15 disabled:opacity-30">SELL MKT</button>
              <button type="button" title="Buy Pending" onClick={() => createPosition("long", "pending")} disabled={!hasData} className="rounded-lg border border-white/10 px-2 py-2 text-[10px] font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-30">BUY LIMIT</button>
              <button type="button" title="Sell Pending" onClick={() => createPosition("short", "pending")} disabled={!hasData} className="rounded-lg border border-white/10 px-2 py-2 text-[10px] font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-30">SELL LIMIT</button>
              <span className="mx-1 w-px bg-white/10" />
              <button type="button" title="Отменить последнее действие" aria-label="Отменить последнее действие"
                onClick={() => { setMarks((current) => current.slice(0, -1)); setPendingPoint(null); setPreviewPoint(null); setSelectedMarkId(null); }}
                disabled={!marks.length && !pendingPoint}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10 disabled:opacity-30"><Undo2 size={16} /></button>
              <button type="button" title="Очистить все пометки" aria-label="Очистить все пометки"
                onClick={() => { setMarks([]); setPendingPoint(null); setPreviewPoint(null); setSelectedMarkId(null); }}
                disabled={!marks.length && !pendingPoint}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/10 disabled:opacity-30"><Trash2 size={16} /></button>
            </div>}
            {reviewMode && <div className="absolute left-3 top-3 z-20 rounded-lg border border-white/10 bg-[#111111]/90 px-3 py-2 text-[10px] font-semibold tracking-wider text-zinc-300">РЕЖИМ АНАЛИЗА · РЕДАКТИРОВАНИЕ ОТКЛЮЧЕНО</div>}
            {!reviewMode && drawingTool !== "cursor" && <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-white/10 bg-[#111111]/90 px-3 py-2 text-[11px] text-zinc-300">{pendingPoint ? "Двигай мышь для размера · второй клик — зафиксировать (Shift — ровная линия)" : "Первый клик — начальная точка"}</div>}
            <div ref={chartContainerRef} onPointerDownCapture={handleChartPointerDown} onPointerMove={handleChartPointerMove} onPointerUp={handleChartPointerUp} onPointerCancel={handleChartPointerUp} className={`absolute inset-0 w-full transition-opacity ${hasData ? "opacity-100" : "pointer-events-none opacity-0"}`} />
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

        {!reviewMode && <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 md:p-5">
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
              onClick={() => {
                if (isPlaying) { setIsPlaying(false); return; }
                if (pendingReviewId !== null || tradeResult !== null) return;
                const hasOrder = marks.some((mark) =>
                  (mark.type === "long" || mark.type === "short") &&
                  (mark.orderType === "pending" || mark.orderType === "market")
                );
                if (!hasOrder) {
                  window.alert("Сначала выставь позицию или лимитный ордер, затем запускай воспроизведение.");
                  return;
                }
                setIsPlaying(true);
              }}
              className="rounded-lg bg-white px-4 py-2 text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
            >{isPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
            <button
              type="button"
              title="Пропустить график"
              onClick={skipCurrentChart}
              disabled={!hasData || loading || reviewMode}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >Skip <SkipForward size={15} /></button>
            {[1, 5, 10].map((count) => (
              <button
                key={count}
                type="button"
                aria-label={`Добавить ${count} свеч${count === 1 ? "у" : count < 5 ? "и" : "ей"}`}
                title={`Вперёд на ${count} свеч${count === 1 ? "у" : count < 5 ? "и" : "ей"}`}
                disabled={!hasData || currentIndex >= totalCandles - 1}
                onClick={() => { setIsPlaying(false); revealCandlesAt(currentIndex + count); }}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >+{count} свеч{count === 1 ? "а" : count < 5 ? "и" : "ей"}</button>
            ))}
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
        </section>}
        {reviewMode && <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-5"><p className="text-xs font-semibold tracking-wider text-zinc-400">РЕЗУЛЬТАТ СДЕЛКИ</p><p className="mt-2 text-lg font-semibold">{tradeResult === "take-profit" ? "Take Profit достигнут" : "Сделка закрыта по Stop Loss"}</p><p className="mt-1 text-xs text-zinc-500">Можно менять масштаб, прокручивать график и переключать таймфреймы. Создание и редактирование пометок отключено.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => router.push("/training")} className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10">Новая тренировка</button><Link href="/" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200">В дашборд</Link></div></section>}
        {!reviewMode && <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
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
        </div>}
      </div>

      {pendingReviewId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111111] p-6 shadow-2xl">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">LIMIT ORDER ACTIVATED</p>
            <h3 className="mt-2 text-xl font-semibold">Лимитный ордер исполнен</h3>
            <p className="mt-2 text-sm text-zinc-400">Цена дошла до точки входа. Хочешь изменить тейк-профит и стоп-лосс перед продолжением?</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400">Take Profit
                <input value={reviewTakeProfit} onChange={(event) => setReviewTakeProfit(event.target.value)} inputMode="decimal" className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white/50" />
              </label>
              <label className="text-xs text-zinc-400">Stop Loss
                <input value={reviewStopLoss} onChange={(event) => setReviewStopLoss(event.target.value)} inputMode="decimal" className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white/50" />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button onClick={continueAfterReview} className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10">Нет, продолжить</button>
              <button onClick={confirmPendingReview} className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black hover:bg-zinc-200">Да, изменить</button>
            </div>
          </div>
        </div>
      )}

      {pendingIdeaPromptId !== null && pendingReviewId === null && tradeResult === null && !reviewMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111111] p-7 text-center shadow-2xl">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">PENDING ORDER · CHECK-IN</p>
            <h3 className="mt-2 text-xl font-semibold">Ваша идея ещё актуальна?</h3>
            <p className="mt-2 text-sm text-zinc-400">Цена пока не дошла до уровня входа. Продолжить ожидание лимитного ордера?</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button onClick={continuePendingIdea} className="flex-1 rounded-lg bg-white px-4 py-3 text-xs font-bold text-black hover:bg-zinc-200">Продолжить</button>
              <button onClick={cancelPendingIdea} className="flex-1 rounded-lg border border-white/15 px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-white/10">Не актуально</button>
            </div>
          </div>
        </div>
      )}

      {pendingCancelledPrompt && !reviewMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111111] p-7 text-center shadow-2xl">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">TRAINING · NEXT STEP</p>
            <h3 className="mt-2 text-xl font-semibold">Лимитный ордер отменён</h3>
            <p className="mt-2 text-sm text-zinc-400">Вы можете продолжить тренировку на этом активе или открыть новый график.</p>
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={() => setPendingCancelledPrompt(false)} className="w-full rounded-lg bg-white px-4 py-3 text-xs font-bold text-black hover:bg-zinc-200">Продолжить на этом активе</button>
              <button onClick={() => router.push("/training")} className="w-full rounded-lg border border-white/15 px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-white/10">Открыть новый график</button>
              <Link href="/" className="w-full rounded-lg border border-white/15 px-4 py-3 text-xs font-semibold text-zinc-400 hover:bg-white/10">В меню</Link>
            </div>
          </div>
        </div>
      )}

      {tradeResult !== null && !reviewMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111111] p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-xl">{tradeResult === "take-profit" ? "✓" : "×"}</div>
            <p className="mt-4 text-[10px] font-semibold tracking-[0.2em] text-zinc-500">TRADE FINISHED</p>
            <h3 className="mt-2 text-2xl font-semibold">{tradeResult === "take-profit" ? "Успешно!" : "Сработал стоп-лосс"}</h3>
            <p className="mt-2 text-sm text-zinc-400">{tradeResult === "take-profit" ? "Тейк-профит достигнут. Отличная работа!" : "Сделка закрыта по стоп-лоссу. Можно разобрать ситуацию и попробовать ещё раз."}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => {
                if (sessionTime !== null && currentReplayTime !== null) {
                  const snapshot: ReviewSnapshot = { instrument, timeframe, sessionTime, currentReplayTime, marks, tradeResult };
                  window.sessionStorage.setItem("urxo-trade-review", JSON.stringify(snapshot));
                  router.push("/training?mode=review");
                }
              }} className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-xs font-semibold text-white hover:bg-white/10">Проанализировать</button>
              <button onClick={() => router.push("/training")} className="flex-1 rounded-lg bg-white px-4 py-3 text-xs font-bold text-black hover:bg-zinc-200">Следующий график</button>
              <Link href="/" className="flex-1 rounded-lg border border-white/15 px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-white/10">Главное меню</Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

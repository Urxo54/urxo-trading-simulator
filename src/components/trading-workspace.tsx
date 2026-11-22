"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { Crosshair, Minus, StickyNote, Trash2 } from "lucide-react";
import { calculateTradePnl, getTriggeredExit, isValidOrderLevels } from "@/lib/trading-logic";

type Instrument = "eurusd" | "xauusd" | "usatechidxusd";
type Side = "BUY" | "SELL";
type Trade = {
  id: string;
  instrument: Instrument;
  side: Side;
  volume: number;
  entry: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: number;
  status: "open" | "closed";
  closedAt?: number;
  closePrice?: number;
};
type Annotation = { id: string; instrument: Instrument; price: number; label: string; createdAt: number };

type Props = {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  instrument: Instrument;
  price: number | null;
  replayTime: number | null;
  decimals: number;
};

const STORAGE_KEY = "urxo-trading-workspace-v1";
const instrumentLabel: Record<Instrument, string> = {
  eurusd: "EUR/USD",
  xauusd: "XAU/USD",
  usatechidxusd: "NAS100",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default function TradingWorkspace({ chart, series, instrument, price, replayTime, decimals }: Props) {
  const [tool, setTool] = useState<"select" | "horizontal" | "note">("select");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [volume, setVolume] = useState("0.01");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { trades?: Trade[]; annotations?: Annotation[] };
        setTrades(Array.isArray(saved.trades) ? saved.trades : []);
        setAnnotations(Array.isArray(saved.annotations) ? saved.annotations : []);
      }
    } catch {
      setMessage("Не удалось прочитать сохранённые сделки. Новые данные можно сохранить заново.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ trades, annotations }));
  }, [trades, annotations, loaded]);

  const activeTrades = useMemo(
    () => trades.filter((trade) => trade.status === "open" && trade.instrument === instrument),
    [trades, instrument],
  );

  const calculatePnl = useCallback((trade: Trade, mark: number) =>
    calculateTradePnl(trade.instrument, trade.side, trade.volume, trade.entry, mark), []);

  useEffect(() => {
    if (price === null || replayTime === null) return;
    setTrades((current) => {
      let changed = false;
      const next = current.map((trade) => {
        if (trade.status !== "open" || trade.instrument !== instrument) return trade;
        const exit = getTriggeredExit(trade.side, price, trade.stopLoss, trade.takeProfit);
        if (!exit) return trade;
        changed = true;
        return { ...trade, status: "closed" as const, closedAt: replayTime, closePrice: exit.price };
      });
      if (changed) setMessage("Сделка автоматически закрыта: достигнут уровень SL или TP.");
      return changed ? next : current;
    });
  }, [price, replayTime, instrument]);

  useEffect(() => {
    if (!series) return;
    const lines = activeTrades.flatMap((trade) => {
      const result = [{
        price: trade.entry,
        color: trade.side === "BUY" ? "#22c55e" : "#ef4444",
        lineWidth: 2 as const,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${trade.side} ${trade.volume} lot`,
      }];
      if (trade.stopLoss !== null) result.push({
        price: trade.stopLoss, color: "#ef4444", lineWidth: 1 as const,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "SL",
      });
      if (trade.takeProfit !== null) result.push({
        price: trade.takeProfit, color: "#22c55e", lineWidth: 1 as const,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "TP",
      });
      return result;
    });
    const annotationLines = annotations.filter((item) => item.instrument === instrument).map((item) => ({
      price: item.price, color: "#a1a1aa", lineWidth: 1 as const,
      lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: item.label,
    }));
    const created = [...lines, ...annotationLines].map((options) => series.createPriceLine(options));
    return () => created.forEach((line) => series.removePriceLine(line));
  }, [series, activeTrades, annotations, instrument]);

  useEffect(() => {
    if (!chart || !series || tool === "select") return;
    const handleClick = (param: Parameters<IChartApi["subscribeClick"]>[0] extends (arg: infer P) => void ? P : never) => {
      if (!param.point || !param.time) return;
      const selectedPrice = series.coordinateToPrice(param.point.y);
      if (selectedPrice === null || !Number.isFinite(selectedPrice)) return;
      if (tool === "horizontal") {
        setAnnotations((current) => [...current, {
          id: crypto.randomUUID(), instrument, price: selectedPrice,
          label: "Level", createdAt: Date.now(),
        }]);
        setMessage(`Уровень ${selectedPrice.toFixed(decimals)} добавлен на график.`);
        setTool("select");
      } else {
        const label = window.prompt("Текст заметки на уровне цены:");
        if (label?.trim()) {
          setAnnotations((current) => [...current, {
            id: crypto.randomUUID(), instrument, price: selectedPrice,
            label: label.trim().slice(0, 60), createdAt: Date.now(),
          }]);
          setMessage("Заметка добавлена на график.");
        }
        setTool("select");
      }
    };
    chart.subscribeClick(handleClick);
    return () => chart.unsubscribeClick(handleClick);
  }, [chart, series, tool, instrument, decimals]);

  function openTrade(side: Side) {
    if (price === null || !Number.isFinite(price)) {
      setMessage("Нет доступной цены для открытия сделки.");
      return;
    }
    const parsedVolume = Number(volume);
    const sl = stopLoss.trim() ? Number(stopLoss) : null;
    const tp = takeProfit.trim() ? Number(takeProfit) : null;
    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0 || parsedVolume > 100) {
      setMessage("Объём должен быть больше 0 и не более 100 лотов.");
      return;
    }
    if (!isValidOrderLevels(side, price, sl, tp)) {
      setMessage(side === "BUY"
        ? "Для BUY: SL ниже цены входа, TP выше цены входа."
        : "Для SELL: SL выше цены входа, TP ниже цены входа.");
      return;
    }
    setTrades((current) => [{
      id: crypto.randomUUID(), instrument, side, volume: parsedVolume, entry: price,
      stopLoss: sl, takeProfit: tp, openedAt: replayTime ?? Date.now(), status: "open",
    }, ...current]);
    setMessage(`${side} ${instrumentLabel[instrument]} открыта по ${price.toFixed(decimals)}.`);
    setStopLoss("");
    setTakeProfit("");
  }

  function closeTrade(id: string) {
    if (price === null) return;
    setTrades((current) => current.map((trade) => trade.id === id
      ? { ...trade, status: "closed", closedAt: replayTime ?? Date.now(), closePrice: price }
      : trade));
  }

  function removeAnnotation(id: string) {
    setAnnotations((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Chart tools</h3>
            <p className="mt-1 text-[11px] text-zinc-500">Выбери инструмент и нажми на нужную цену на графике</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTool("select")} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${tool === "select" ? "border-white bg-white text-black" : "border-white/10 text-zinc-300"}`}><Crosshair size={14}/>Курсор</button>
            <button onClick={() => setTool("horizontal")} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${tool === "horizontal" ? "border-white bg-white text-black" : "border-white/10 text-zinc-300"}`}><Minus size={14}/>Уровень</button>
            <button onClick={() => setTool("note")} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${tool === "note" ? "border-white bg-white text-black" : "border-white/10 text-zinc-300"}`}><StickyNote size={14}/>Заметка</button>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-4">
          <h4 className="text-xs font-semibold text-zinc-300">Разметка {instrumentLabel[instrument]}</h4>
          <span className="text-[10px] text-zinc-600">{annotations.filter((item) => item.instrument === instrument).length} объектов</span>
        </div>
        <div className="mt-2 space-y-2">
          {annotations.filter((item) => item.instrument === instrument).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs">
              <span className="min-w-0 truncate text-zinc-300">{item.label} · {item.price.toFixed(decimals)}</span>
              <button aria-label="Удалить разметку" onClick={() => removeAnnotation(item.id)} className="ml-3 text-zinc-500 hover:text-white"><Trash2 size={14}/></button>
            </div>
          ))}
          {annotations.filter((item) => item.instrument === instrument).length === 0 && <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-zinc-600">Пока нет разметки. Выбери «Уровень» или «Заметка» и кликни по графику.</p>}
        </div>
        {message && <p role="status" className="mt-3 text-xs text-zinc-400">{message}</p>}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4">
        <h3 className="text-sm font-semibold">New market order</h3>
        <p className="mt-1 text-[11px] text-zinc-500">{instrumentLabel[instrument]} · текущая цена {price === null ? "—" : price.toFixed(decimals)}</p>
        <label className="mt-4 block text-xs text-zinc-400">Объём (лоты)
          <input type="number" min="0.01" max="100" step="0.01" value={volume} onChange={(event) => setVolume(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-white/40"/>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-zinc-400">Stop Loss
            <input type="number" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} placeholder="Не задан" className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none"/>
          </label>
          <label className="text-xs text-zinc-400">Take Profit
            <input type="number" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} placeholder="Не задан" className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none"/>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => openTrade("BUY")} disabled={price === null} className="rounded-lg bg-white px-3 py-3 text-xs font-bold text-black transition hover:bg-zinc-200 disabled:opacity-40">BUY / LONG</button>
          <button onClick={() => openTrade("SELL")} disabled={price === null} className="rounded-lg border border-white/20 px-3 py-3 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-40">SELL / SHORT</button>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">Виртуальные сделки для обучения. Расчёт P/L ориентировочный, без спреда, комиссии и конвертации валюты счёта.</p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold">Open positions</h3><p className="mt-1 text-[11px] text-zinc-500">Виртуальные сделки сохраняются в этом браузере</p></div>
          <span className="text-xs text-zinc-500">{activeTrades.length} открыто</span>
        </div>
        {activeTrades.length ? (
          <div className="mt-4 space-y-2">
            {activeTrades.map((trade) => {
              const pnl = price === null ? 0 : calculatePnl(trade, price);
              return <div key={trade.id} className="grid gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                <div><p className={`text-xs font-bold ${trade.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{trade.side} {instrumentLabel[trade.instrument]}</p><p className="mt-1 text-[10px] text-zinc-500">{trade.volume} lot · Entry {trade.entry.toFixed(decimals)}</p></div>
                <div className="text-xs text-zinc-400">SL {trade.stopLoss?.toFixed(decimals) ?? "—"} <span className="mx-2 text-zinc-700">|</span> TP {trade.takeProfit?.toFixed(decimals) ?? "—"}</div>
                <div><p className={`text-sm font-semibold tabular-nums ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatMoney(pnl)}</p><p className="text-[10px] text-zinc-600">Unrealized P/L</p></div>
                <button onClick={() => closeTrade(trade.id)} disabled={price === null} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 disabled:opacity-40">Close position</button>
              </div>;
            })}
          </div>
        ) : <p className="mt-4 rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-zinc-600">Нет открытых сделок по этому инструменту.</p>}
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 xl:col-span-2">
        <h3 className="text-sm font-semibold">Trade history</h3>
        <div className="mt-3 space-y-2">
          {trades.filter((trade) => trade.status === "closed").slice(0, 10).map((trade) => {
            const pnl = calculatePnl(trade, trade.closePrice ?? trade.entry);
            return <div key={trade.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs"><span className="text-zinc-300">{trade.side} {instrumentLabel[trade.instrument]} · {trade.volume} lot</span><span className="text-zinc-500">{trade.entry.toFixed(decimals)} → {(trade.closePrice ?? trade.entry).toFixed(decimals)}</span><span className={pnl >= 0 ? "text-green-400" : "text-red-400"}>{formatMoney(pnl)}</span></div>;
          })}
          {!trades.some((trade) => trade.status === "closed") && <p className="py-4 text-center text-xs text-zinc-600">Закрытых сделок пока нет.</p>}
        </div>
      </div>
    </section>
  );
}

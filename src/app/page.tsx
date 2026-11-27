
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readPointsAccount, type PointsAccount, type TradeHistoryItem } from "@/lib/points-account";

import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CandlestickChart,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Database,
  LayoutDashboard,
  LoaderCircle,
  Play,
  Settings,
  ShieldCheck,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";

const menu = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Training", icon: CandlestickChart },
  { label: "Statistics", icon: BarChart3 },
  { label: "History", icon: Clock3 },
];

type ImportEvent = {
  type: "progress" | "month-completed" | "log" | "completed" | "done" | "error";
  instrument?: string;
  label?: string;
  current?: number;
  total?: number;
  month?: string;
  monthCurrent?: number;
  monthTotal?: number;
  completedUnits?: number;
  totalUnits?: number;
  message?: string;
  count?: number;
  sizeBytes?: number;
};

type MarketDataItem = {
  id: string;
  label: string;
  status: "ready" | "partial" | "missing" | "invalid" | "error";
  count: number;
  sizeBytes: number;
  modifiedAt: string | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("Ready to import 2024–2025 historical data.");
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<string[]>([]);
  const [importFailed, setImportFailed] = useState(false);
  const [marketData, setMarketData] = useState<MarketDataItem[]>([]);
  const [marketDataLoading, setMarketDataLoading] = useState(true);
  const [account, setAccount] = useState<PointsAccount>({ balance: 100, trades: [] });

  useEffect(() => {
    const refresh = () => setAccount(readPointsAccount());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("urxo-points-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("urxo-points-updated", refresh);
    };
  }, []);

  const wins = account.trades.filter((trade) => trade.result === "take-profit").length;
  const winRate = account.trades.length ? Math.round((wins / account.trades.length) * 100) : 0;
  const equityPoints = useMemo(() => [...account.trades].reverse().map((trade) => trade.balanceAfter), [account.trades]);

  function openTradeReview(trade: TradeHistoryItem) {
    const snapshot = {
      instrument: trade.instrument,
      timeframe: trade.timeframe,
      sessionTime: trade.sessionTime,
      currentReplayTime: trade.closeTime,
      marks: trade.marks,
      tradeResult: trade.result,
    };
    window.sessionStorage.setItem("urxo-trade-review", JSON.stringify(snapshot));
    router.push("/training?mode=review");
  }

  useEffect(() => {
    let active = true;

    async function refreshMarketData() {
      try {
        const response = await fetch("/api/market-data", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not inspect local market data.");
        const result = (await response.json()) as { markets?: MarketDataItem[] };
        if (active && Array.isArray(result.markets)) setMarketData(result.markets);
      } catch {
        if (active) setMarketData([]);
      } finally {
        if (active) setMarketDataLoading(false);
      }
    }

    void refreshMarketData();
    const interval = window.setInterval(refreshMarketData, importing ? 2000 : 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [importing]);

  async function importHistoricalData() {
    setImporting(true);
    setImportProgress(0);
    setImportResults([]);
    setImportFailed(false);
    setImportStatus("Preparing monthly historical download...");

    let receivedDoneEvent = false;
    const downloadController = new AbortController();

    const handleEvent = (rawEvent: string) => {
      const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) return;

      let data: ImportEvent;
      try {
        data = JSON.parse(dataLine.slice(6)) as ImportEvent;
      } catch {
        throw new Error("The download service sent an unreadable progress update.");
      }

      if (data.type === "progress") {
        const completed = data.completedUnits ?? 0;
        const total = data.totalUnits ?? 72;
        setImportProgress(Math.min(99, Math.round((completed / total) * 100)));
        setImportStatus(data.message ?? "Downloading historical candles...");
      } else if (data.type === "month-completed") {
        const completed = data.completedUnits ?? 0;
        const total = data.totalUnits ?? 72;
        setImportProgress(Math.min(99, Math.round((completed / total) * 100)));
        setImportStatus(
          `${data.label ?? "Market"} · ${data.month ?? "Month"} verified · ${completed}/${total} monthly files`,
        );
      } else if (data.type === "completed") {
        setImportResults((previous) => [
          ...previous,
          `✓ ${data.label}: ${Number(data.count ?? 0).toLocaleString()} candles · ${formatBytes(data.sizeBytes ?? 0)}`,
        ]);
      } else if (data.type === "done") {
        receivedDoneEvent = true;
        setImportProgress(100);
        setImportStatus(data.message ?? "Download complete.");
      } else if (data.type === "error") {
        throw new Error(data.message ?? "Historical data download failed.");
      }
    };

    try {
      const response = await fetch("/api/import-history", {
        method: "POST",
        signal: downloadController.signal,
      });
      if (!response.ok || !response.body) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Could not start download.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) handleEvent(event);
      }

      buffer += decoder.decode();
      if (buffer.trim()) handleEvent(buffer);
      if (!receivedDoneEvent) {
        throw new Error("The connection closed before the download was verified. Check the dataset status and try again.");
      }
    } catch (error) {
      downloadController.abort();
      setImportFailed(true);
      setImportStatus(error instanceof Error ? error.message : "Historical data download failed.");
    } finally {
      setImporting(false);
      try {
        const response = await fetch("/api/market-data", { cache: "no-store" });
        const result = (await response.json()) as { markets?: MarketDataItem[] };
        if (response.ok && Array.isArray(result.markets)) setMarketData(result.markets);
      } catch {
        // The periodic status refresh will retry.
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <aside className="fixed left-0 top-0 hidden h-screen w-[245px] border-r border-white/[0.08] bg-[#0c0c0c] p-6 lg:flex lg:flex-col">
        <div className="mb-12 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
            <Activity size={23} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-[0.18em]">URXO</h1>
            <p className="text-[10px] tracking-[0.2em] text-zinc-500">TRADING LAB</p>
          </div>
        </div>

        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
          Workspace
        </p>

        <nav className="space-y-2">
          {menu.map((item) => {
            const href = item.label === "Dashboard"
              ? "/"
              : item.label === "Training"
                ? "/training"
                : item.label === "Statistics"
                  ? "/statistics"
                  : "/history";
            return (
              <Link
                key={item.label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                  item.active
                    ? "bg-white/[0.09] font-medium text-white"
                    : "text-zinc-500 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <item.icon size={18} />
                {item.label}
                {item.active && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </a>
            );
          })}
        </nav>

        <div className="mt-10">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            System
          </p>
          <div className="space-y-4 text-sm text-zinc-500">
            <div className="flex items-center gap-3"><Database size={18} /> Market Data</div>
            <Link href="/settings" className="flex items-center gap-3 transition hover:text-white"><Settings size={18} /> Settings</Link>
            <Link href="/help" className="flex items-center gap-3 transition hover:text-white"><CircleHelp size={18} /> Help Center</Link>
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={17} className="text-white" />
            <span className="text-xs font-medium">Simulation Mode</span>
          </div>
          <p className="text-[11px] leading-5 text-zinc-500">
            Practice on historical market data without risking real money.
          </p>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            System ready
          </div>
        </div>
      </aside>

      <section className="min-h-screen lg:ml-[245px]">
        <header className="flex h-[76px] items-center justify-between border-b border-white/[0.08] px-6 md:px-10">
          <div>
            <p className="text-xs text-zinc-600">Workspace / Overview</p>
            <h2 className="mt-1 text-lg font-semibold">Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500 sm:block">
              FREE TRAINING
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-sm font-semibold text-white">
              U
            </div>
          </div>
        </header>

        <div id="dashboard" className="mx-auto max-w-[1400px] p-6 md:p-10">
          <div className="mb-9">
            <p className="mb-2 text-sm text-zinc-400">YOUR PERSONAL TRADING ENVIRONMENT</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Welcome to <span className="text-white">URXO.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
              Improve your trading skills. Study historical markets, practice your strategy
              and develop consistency.
            </p>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Sessions", value: String(account.trades.length), icon: Activity },
              { label: "Total Trades", value: String(account.trades.length), icon: TrendingUp },
              { label: "Win Rate", value: account.trades.length ? `${winRate}%` : "—", icon: Crosshair },
              { label: "Points Balance", value: `${account.balance} pts`, icon: Wallet },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{stat.label}</span>
                  <stat.icon size={18} className="text-zinc-300" />
                </div>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-br from-[#202020] via-[#141414] to-[#101010] p-7 md:p-9">
              <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/[0.035] blur-3xl" />
              <div className="relative">
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-zinc-300">
                  HISTORICAL REPLAY
                </span>
                <h2 className="mt-7 text-2xl font-semibold md:text-3xl">Start a new training</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
                  Choose a market, load a historical period and test your trading decisions
                  in a realistic environment.
                </p>
                <Link href="/training" className="mt-8 flex w-fit items-center gap-3 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200">
                  <Play size={17} fill="currentColor" />
                  Start Training
                  <ChevronRight size={17} />
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-7">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Market Data</h3>
                  <p className="mt-1 text-xs text-zinc-500">Local historical market data · M1</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">2024–2025 · M1</p>
                    <p className="mt-1 text-xs text-zinc-500">EUR/USD · Gold · NAS100 · 2 years</p>
                  </div>
                  <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-zinc-300">DUKASCOPY</span>
                </div>
                <button
                  onClick={importHistoricalData}
                  disabled={importing}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
                  {importing ? "Downloading 2024–2025..." : "Download 2024–2025 candles"}
                </button>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${importProgress}%` }} />
                </div>
                <p className={`mt-3 flex items-start gap-2 break-words text-xs leading-5 ${importFailed ? "text-red-300" : "text-zinc-400"}`}>{importFailed && <AlertCircle size={14} className="mt-0.5 shrink-0" />}{importStatus}</p>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-zinc-300">Local datasets</p>
                    <span className="text-[10px] text-zinc-600">
                      {marketDataLoading
                        ? "Checking..."
                        : `${marketData.filter((item) => item.status === "ready").length}/3 ready`}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {marketData.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-300">{item.label}</p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {item.count.toLocaleString()} candles · {formatBytes(item.sizeBytes)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
                          {item.status === "ready" ? (
                            <CheckCircle2 size={13} className="text-zinc-200" />
                          ) : item.status === "partial" || item.status === "invalid" || item.status === "error" ? (
                            <AlertCircle size={13} className={item.status === "partial" ? "text-amber-300" : "text-red-300"} />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                          )}
                          <span
                            className={
                              item.status === "ready"
                                ? "text-zinc-300"
                                : item.status === "partial"
                                  ? "text-amber-300"
                                  : item.status === "error" || item.status === "invalid"
                                    ? "text-red-300"
                                    : "text-zinc-600"
                            }
                          >
                            {item.status === "ready"
                              ? "Verified"
                              : item.status === "partial"
                                ? "Partial"
                                : item.status === "invalid"
                                  ? "Invalid"
                                  : item.status === "error"
                                    ? "Read error"
                                    : "Missing"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {!marketDataLoading && marketData.length === 0 && (
                      <p className="text-[11px] text-zinc-600">Could not read local data status.</p>
                    )}
                  </div>
                </div>
                {importResults.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                    {importResults.map((result, index) => (
                      <p key={index} className="text-[11px] text-zinc-500">{result}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Output format</span>
                <span className="rounded-md bg-white/5 px-2 py-1 text-zinc-300">CSV · M1</span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111111] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Trading Environment</h3>
              <span className="text-[10px] tracking-wider text-zinc-600">CONFIGURATION</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                { label: "Markets", value: "Forex · Gold · Indices" },
                { label: "Timeframes", value: "D1 · H4 · H1" },
                { label: "Account Type", value: "Points · 100 starting points" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-zinc-600">{item.label}</p>
                  <p className="mt-2 text-sm text-zinc-300">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t border-white/[0.08] pt-6 text-[10px] text-zinc-600">
            <span>URXO TRADING LAB · HISTORICAL MARKET SIMULATOR</span>
            <span>VERSION 0.1.0 · SIMULATION ONLY</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

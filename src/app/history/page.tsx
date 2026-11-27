"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, CandlestickChart, ChevronRight, Clock3, LayoutDashboard } from "lucide-react";
import { readPointsAccount, type PointsAccount, type TradeHistoryItem } from "@/lib/points-account";

const nav = [
  { label: "Dashboard", href: "/", Icon: LayoutDashboard },
  { label: "Training", href: "/training", Icon: CandlestickChart },
  { label: "Statistics", href: "/statistics", Icon: BarChart3 },
  { label: "History", href: "/history", Icon: Clock3 },
];

export default function HistoryPage() {
  const router = useRouter();
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

  function openReview(trade: TradeHistoryItem) {
    window.sessionStorage.setItem("urxo-trade-review", JSON.stringify({
      instrument: trade.instrument,
      timeframe: trade.timeframe,
      sessionTime: trade.sessionTime,
      currentReplayTime: trade.closeTime,
      marks: trade.marks,
      tradeResult: trade.result,
    }));
    router.push("/training?mode=review");
  }

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-[245px] flex-col border-r border-white/[0.08] bg-[#0d0d0d] p-6 lg:flex">
        <Link href="/" className="mb-10 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black"><Activity size={23} /></div><div><h1 className="text-lg font-bold tracking-[0.18em]">URXO</h1><p className="text-[10px] tracking-[0.2em] text-zinc-500">TRADING LAB</p></div></Link>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Workspace</p>
        <nav className="space-y-2">{nav.map(({label,href,Icon}) => <Link key={label} href={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${label === "History" ? "bg-white/[0.09] font-medium text-white" : "text-zinc-500 hover:bg-white/[0.05] hover:text-white"}`}><Icon size={18}/>{label}</a>)}</nav>
      </aside>
      <section className="min-h-screen lg:ml-[245px]">
        <header className="flex h-[76px] items-center justify-between border-b border-white/[0.08] px-6 md:px-10"><div><p className="text-xs text-zinc-600">Workspace / History</p><h2 className="mt-1 text-lg font-semibold">Trade History</h2></div><div className="rounded-xl border border-white/10 px-4 py-2 text-sm"><span className="text-zinc-500">Balance </span><b>{account.balance} pts</b></div></header>
        <div className="mx-auto max-w-[1100px] p-6 md:p-10">
          <div className="mb-8"><h1 className="text-3xl font-semibold">History</h1><p className="mt-2 text-sm text-zinc-500">Все закрытые сделки. Нажми на сделку, чтобы открыть график и разобрать решение.</p></div>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Total trades</p><p className="mt-2 text-2xl font-semibold">{account.trades.length}</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Wins</p><p className="mt-2 text-2xl font-semibold">{account.trades.filter(t=>t.result==="take-profit").length}</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Net points</p><p className="mt-2 text-2xl font-semibold">{account.balance-100>0?"+":""}{account.balance-100}</p></div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">Closed trades</h2><span className="text-xs text-zinc-500">{account.trades.length} records</span></div>
            {account.trades.length===0 ? <div className="rounded-xl border border-dashed border-white/10 px-4 py-16 text-center"><Clock3 className="mx-auto mb-3 text-zinc-600" size={25}/><p className="text-sm text-zinc-400">Пока нет закрытых сделок</p><p className="mt-1 text-xs text-zinc-600">Результаты появятся здесь после первого TP или SL.</p><Link href="/training" className="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black">Начать тренировку</Link></div> : <div className="space-y-2">{account.trades.map(trade=><button key={trade.id} type="button" onClick={()=>openReview(trade)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-left transition hover:border-white/20 hover:bg-white/[0.04]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{trade.instrument.toUpperCase()}</b><span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-zinc-400">{trade.timeframe}</span><span className="text-[10px] text-zinc-500">{trade.result==="take-profit"?"TAKE PROFIT":"STOP LOSS"}</span><span className="text-[10px] text-zinc-400">RR 1:{trade.rr ?? "—"}</span></div><p className="mt-1 text-[11px] text-zinc-500">{new Date(trade.closeTime*1000).toLocaleString("ru-RU",{timeZone:"UTC"})} UTC</p></div><div className="shrink-0 text-right"><p className={`text-sm font-semibold ${trade.pointsDelta>0?"text-emerald-300":"text-zinc-300"}`}>{trade.pointsDelta>0?"+":""}{trade.pointsDelta} pts</p><p className="mt-1 text-[10px] text-zinc-500">Баланс {trade.balanceAfter}</p></div><ChevronRight size={17} className="text-zinc-500"/></button>)}</div>}
          </div>
        </div>
      </section>
    </main>
  );
}

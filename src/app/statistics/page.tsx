"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CandlestickChart, Clock3, LayoutDashboard } from "lucide-react";
import { readPointsAccount, type PointsAccount } from "@/lib/points-account";

const nav = [
  { label: "Dashboard", href: "/", Icon: LayoutDashboard },
  { label: "Training", href: "/training", Icon: CandlestickChart },
  { label: "Statistics", href: "/statistics", Icon: BarChart3 },
  { label: "History", href: "/history", Icon: Clock3 },
];

export default function StatisticsPage() {
  const [account, setAccount] = useState<PointsAccount>({ balance: 100, trades: [] });
  useEffect(() => {
    const refresh = () => setAccount(readPointsAccount());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("urxo-points-updated", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("urxo-points-updated", refresh); };
  }, []);

  const ordered = useMemo(() => [...account.trades].reverse(), [account.trades]);
  const values = useMemo(() => [100, ...ordered.map(t=>t.balanceAfter)], [ordered]);
  const wins = account.trades.filter(t=>t.result==="take-profit").length;
  const losses = account.trades.length-wins;
  const winRate = account.trades.length ? Math.round(wins/account.trades.length*100) : 0;
  let bestStreak=0, streak=0;
  for (const trade of ordered) { streak=trade.result==="take-profit"?streak+1:0; bestStreak=Math.max(bestStreak,streak); }
  const maxDrawdown = (() => { let peak=values[0], worst=0; for(const value of values){peak=Math.max(peak,value);worst=Math.max(worst,peak-value);} return worst; })();
  const min=Math.min(...values,100)-5, max=Math.max(...values,100)+5, span=Math.max(1,max-min);
  const points=values.map((value,index)=>({x:16+index*608/Math.max(1,values.length-1),y:164-(value-min)/span*140}));

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-[245px] flex-col border-r border-white/[0.08] bg-[#0d0d0d] p-6 lg:flex">
        <Link href="/" className="mb-10 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black"><Activity size={23}/></div><div><h1 className="text-lg font-bold tracking-[0.18em]">URXO</h1><p className="text-[10px] tracking-[0.2em] text-zinc-500">TRADING LAB</p></div></Link>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Workspace</p>
        <nav className="space-y-2">{nav.map(({label,href,Icon})=><Link key={label} href={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${label==="Statistics"?"bg-white/[0.09] font-medium text-white":"text-zinc-500 hover:bg-white/[0.05] hover:text-white"}`}><Icon size={18}/>{label}</Link>)}</nav>
      </aside>
      <section className="min-h-screen lg:ml-[245px]">
        <header className="flex h-[76px] items-center justify-between border-b border-white/[0.08] px-6 md:px-10"><div><p className="text-xs text-zinc-600">Workspace / Statistics</p><h2 className="mt-1 text-lg font-semibold">Statistics</h2></div><div className="rounded-xl border border-white/10 px-4 py-2 text-sm"><span className="text-zinc-500">Balance </span><b>{account.balance} pts</b></div></header>
        <div className="mx-auto max-w-[1100px] p-6 md:p-10">
          <div className="mb-8"><h1 className="text-3xl font-semibold">Your performance</h1><p className="mt-2 text-sm text-zinc-500">Следи за динамикой баланса и качеством своих торговых решений.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Current balance</p><p className="mt-2 text-2xl font-semibold">{account.balance} pts</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Net result</p><p className="mt-2 text-2xl font-semibold">{account.balance-100>0?"+":""}{account.balance-100} pts</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Win rate</p><p className="mt-2 text-2xl font-semibold">{account.trades.length?winRate+"%":"—"}</p><p className="mt-1 text-[10px] text-zinc-600">{wins} wins / {losses} losses</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Max drawdown</p><p className="mt-2 text-2xl font-semibold">−{maxDrawdown} pts</p></div>
          </div>
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111] p-5 md:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Points balance curve</h2><p className="mt-1 text-xs text-zinc-500">Изменение баланса после каждой закрытой сделки</p></div><span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400">Start · 100 pts</span></div>
            {account.trades.length===0 ? <div className="flex h-64 flex-col items-center justify-center text-center"><BarChart3 size={28} className="mb-3 text-zinc-600"/><p className="text-sm text-zinc-400">Пока недостаточно данных</p><p className="mt-1 text-xs text-zinc-600">Кривая появится после закрытия первой сделки.</p><Link href="/training" className="mt-5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black">Начать тренировку</Link></div> : <svg viewBox="0 0 640 180" role="img" aria-label="График изменения баланса очков" className="h-64 w-full overflow-visible"><line x1="16" y1={164-(100-min)/span*140} x2="624" y2={164-(100-min)/span*140} stroke="rgba(255,255,255,.22)" strokeDasharray="5 5"/><polyline points={points.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#e4e4e7" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff"/>)}</svg>}
            <div className="mt-3 flex justify-between text-[10px] text-zinc-600"><span>100 pts · старт</span><span>{account.trades.length} закрытых сделок</span><span>{account.balance} pts · сейчас</span></div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Best winning streak</p><p className="mt-2 text-2xl font-semibold">{bestStreak} <span className="text-sm font-normal text-zinc-500">trades</span></p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-xs text-zinc-500">Average points / trade</p><p className="mt-2 text-2xl font-semibold">{account.trades.length?((account.balance-100)/account.trades.length>0?"+":"") + ((account.balance-100)/account.trades.length).toFixed(1):"—"} <span className="text-sm font-normal text-zinc-500">pts</span></p></div>
          </div>
        </div>
      </section>
    </main>
  );
}

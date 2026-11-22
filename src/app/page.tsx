
"use client";

import {
  Activity,
  BarChart3,
  CandlestickChart,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Database,
  LayoutDashboard,
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

export default function Home() {
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
          {menu.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
                item.active
                  ? "bg-white/[0.09] font-medium text-white"
                  : "text-zinc-500"
              }`}
            >
              <item.icon size={18} />
              {item.label}
              {item.active && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </div>
          ))}
        </nav>

        <div className="mt-10">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            System
          </p>
          <div className="space-y-4 text-sm text-zinc-500">
            <div className="flex items-center gap-3"><Database size={18} /> Market Data</div>
            <div className="flex items-center gap-3"><Settings size={18} /> Settings</div>
            <div className="flex items-center gap-3"><CircleHelp size={18} /> Help Center</div>
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

        <div className="mx-auto max-w-[1400px] p-6 md:p-10">
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
              { label: "Total Sessions", value: "0", icon: Activity },
              { label: "Total Trades", value: "0", icon: TrendingUp },
              { label: "Win Rate", value: "—", icon: Crosshair },
              { label: "Virtual Balance", value: "$10,000", icon: Wallet },
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
                <button className="mt-8 flex items-center gap-3 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200">
                  <Play size={17} fill="currentColor" />
                  Start Training
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-7">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Market Data</h3>
                  <p className="mt-1 text-xs text-zinc-500">Historical CSV files</p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
                <Database size={26} className="mx-auto text-zinc-600" />
                <p className="mt-4 text-sm font-medium">No data imported</p>
                <p className="mt-2 text-xs leading-5 text-zinc-600">
                  Import historical market data to start your first simulation.
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Supported format</span>
                <span className="rounded-md bg-white/5 px-2 py-1 text-zinc-300">CSV</span>
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
                { label: "Markets", value: "Forex · Gold · Indices · Crypto" },
                { label: "Timeframes", value: "D1 · H4 · H1" },
                { label: "Account Type", value: "Virtual · $10,000" },
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

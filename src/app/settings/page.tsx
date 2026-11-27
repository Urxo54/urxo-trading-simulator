"use client";

import Link from "next/link";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { applyTheme } from "@/components/theme-provider";

export default function SettingsPage() {
  return (
    <main className="theme-settings min-h-screen px-5 py-10 md:px-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm opacity-70 transition hover:opacity-100">
          <ArrowLeft size={17} /> Back to dashboard
        </Link>
        <p className="text-xs font-semibold tracking-[0.2em] opacity-50">URXO TRADING LAB</p>
        <h1 className="mt-3 text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm opacity-60">Customize the appearance of your workspace.</p>
        <section className="mt-10 rounded-2xl border p-6 md:p-8">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="mt-1 text-sm opacity-60">Choose the theme used across the trading simulator.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => applyTheme("dark")} className="theme-choice dark-choice rounded-xl border p-5 text-left transition">
              <div className="mb-5 flex items-center justify-between"><Moon size={22} /><span className="theme-selected-label text-xs font-semibold">Selected</span></div>
              <span className="block font-semibold">Dark</span><span className="mt-1 block text-sm opacity-60">The original dark workspace</span>
              <div className="mt-5 flex h-16 overflow-hidden rounded-lg border border-white/10 bg-[#08090d] p-2"><div className="w-1/4 rounded bg-[#20232b]" /><div className="ml-2 flex-1 rounded bg-[#15171d]" /></div>
            </button>
            <button type="button" onClick={() => applyTheme("light")} className="theme-choice light-choice rounded-xl border p-5 text-left transition">
              <div className="mb-5 flex items-center justify-between"><Sun size={22} /><span className="theme-selected-label text-xs font-semibold">Selected</span></div>
              <span className="block font-semibold">Light</span><span className="mt-1 block text-sm opacity-60">A bright, clean workspace</span>
              <div className="mt-5 flex h-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-2"><div className="w-1/4 rounded bg-slate-300" /><div className="ml-2 flex-1 rounded bg-white" /></div>
            </button>
          </div>
          <p className="mt-5 text-xs opacity-50">Your choice is saved on this device and will be remembered next time.</p>
        </section>
      </div>
    </main>
  );
}

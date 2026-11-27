"use client";

import { useState } from "react";
import { Activity, ArrowRight } from "lucide-react";

export default function WelcomeOnboarding() {
  const [entered, setEntered] = useState(false);

  if (entered) return null;

  return (
    <div className="urxo-intro" role="dialog" aria-modal="true" aria-labelledby="urxo-intro-title">
      <div className="urxo-intro-noise" />
      <div className="urxo-intro-grid" />
      <div className="urxo-intro-glow urxo-intro-glow-a" />
      <div className="urxo-intro-glow urxo-intro-glow-b" />

      <div className="urxo-intro-top">
        <div className="urxo-intro-logo"><Activity size={18} strokeWidth={1.7} /><span>URXO</span><i /> <small>TRADING SIMULATOR</small></div>
        <span className="urxo-intro-edition">MARKET REPLAY EXPERIENCE <b> / 2026</b></span>
      </div>

      <main className="urxo-intro-main">
        <div className="urxo-intro-chart" aria-hidden="true">
          <div className="urxo-intro-chart-glow" />
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="urxo-intro-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#8da8bd" stopOpacity="0" />
                <stop offset="45%" stopColor="#d7e4ef" stopOpacity=".72" />
                <stop offset="100%" stopColor="#f4f7fb" stopOpacity=".95" />
              </linearGradient>
              <linearGradient id="urxo-intro-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#dbeafe" stopOpacity=".12" />
                <stop offset="100%" stopColor="#dbeafe" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="urxo-intro-area" d="M0 235 L75 218 125 230 180 176 225 193 280 150 330 170 390 112 435 132 490 95 545 125 600 65 650 88 705 45 755 78 810 32 860 54 920 18 1000 28 V300 H0Z" />
            <path className="urxo-intro-line" d="M0 235 L75 218 125 230 180 176 225 193 280 150 330 170 390 112 435 132 490 95 545 125 600 65 650 88 705 45 755 78 810 32 860 54 920 18 1000 28" />
            <circle className="urxo-intro-dot" cx="1000" cy="28" r="4" />
          </svg>
          <div className="urxo-intro-chart-label"><span>PRICE ACTION</span><span>HISTORICAL DATA · LIVE DECISIONS</span></div>
        </div>

        <div className="urxo-intro-copy">
          <div className="urxo-intro-kicker"><span /> YOUR EDGE STARTS WITH PRACTICE</div>
          <h1 id="urxo-intro-title">Добро пожаловать<br /><em>в URXO.</em></h1>
          <p className="urxo-intro-lead">Рынок уже оставил свой след. Теперь твоя очередь научиться его читать.</p>
          <p className="urxo-intro-description">URXO — торговый тренажёр на исторических данных. Отрабатывай стратегии, принимай решения по графику и проверяй себя в условиях рынка — без риска реальными деньгами.</p>
          <button type="button" className="urxo-intro-cta" onClick={() => setEntered(true)}>
            Начать практику <ArrowRight size={17} />
          </button>
          <div className="urxo-intro-proof"><span>01 <b>ИЗУЧАЙ</b></span><i /><span>02 <b>ПРАКТИКУЙСЯ</b></span><i /><span>03 <b>АНАЛИЗИРУЙ</b></span></div>
        </div>
      </main>

      <div className="urxo-intro-bottom"><span>TRAIN YOUR PROCESS. NOT YOUR LUCK.</span><span>BUILT FOR DISCIPLINED TRADERS <b>●</b></span></div>
    </div>
  );
}

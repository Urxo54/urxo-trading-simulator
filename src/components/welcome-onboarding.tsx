"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, Crosshair, LineChart } from "lucide-react";

type IntroStage = 0 | 1 | 2;

export default function WelcomeOnboarding() {
  const [stage, setStage] = useState<IntroStage>(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const introTimer = window.setTimeout(() => setStage(1), 1800);
    const detailsTimer = window.setTimeout(() => setStage(2), 3900);
    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(detailsTimer);
    };
  }, []);

  if (entered) return null;

  return (
    <div className={"urxo-intro urxo-intro-stage-" + stage} role="dialog" aria-modal="true" aria-labelledby="urxo-intro-title">
      <div className="urxo-intro-noise" />
      <div className="urxo-intro-grid" />
      <div className="urxo-intro-glow urxo-intro-glow-a" />
      <div className="urxo-intro-glow urxo-intro-glow-b" />

      <div className="urxo-intro-top">
        <div className="urxo-intro-logo"><Activity size={18} strokeWidth={1.7} /><span>URXO</span><i /><small>TRADING SIMULATOR</small></div>
        <span className="urxo-intro-edition">MARKET REPLAY EXPERIENCE <b>/ 2026</b></span>
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
            <path className="urxo-intro-trace" d="M0 235 L75 218 125 230 180 176 225 193 280 150 330 170 390 112 435 132 490 95 545 125 600 65 650 88 705 45 755 78 810 32 860 54 920 18 1000 28" />
            <circle className="urxo-intro-runner" r="5"><animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path="M0 235 L75 218 125 230 180 176 225 193 280 150 330 170 390 112 435 132 490 95 545 125 600 65 650 88 705 45 755 78 810 32 860 54 920 18 1000 28" /></circle>
          </svg>
          <div className="urxo-intro-chart-label"><span>PRICE ACTION</span><span>HISTORICAL DATA · LIVE DECISIONS</span></div>
        </div>

        <section className={"urxo-intro-scene " + (stage >= 0 ? "is-visible" : "")} aria-hidden={stage !== 0}>
          <div className="urxo-intro-kicker"><span /> A NEW WAY TO PRACTICE</div>
          <h1 id="urxo-intro-title">Добро пожаловать</h1>
          <div className="urxo-intro-welcome-brand">в <em>URXO.</em></div>
          <div className="urxo-intro-scene-index">01 <i /> 03</div>
        </section>

        <section className={"urxo-intro-scene urxo-intro-info " + (stage >= 1 ? "is-visible" : "")} aria-hidden={stage !== 1}>
          <div className="urxo-intro-kicker"><span /> ТВОЯ ПРАКТИКА НАЧИНАЕТСЯ ЗДЕСЬ</div>
          <h2>Рынок. Опыт. <em>Твой прогресс.</em></h2>
          <p className="urxo-intro-info-lead">URXO — торговый тренажёр на исторических рыночных данных. Учись читать график и оттачивай торговые решения без риска реальными деньгами.</p>
          <div className="urxo-intro-features">
            <div><BarChart3 /><span><b>Исторические данные</b><small>Изучай реальные движения рынка</small></span></div>
            <div><Crosshair /><span><b>Практика сделок</b><small>Открывай позиции, выставляй стоп и тейк</small></span></div>
          </div>
          <div className="urxo-intro-scene-index">02 <i /> 03</div>
        </section>

        <section className={"urxo-intro-scene urxo-intro-entry " + (stage >= 2 ? "is-visible" : "")} aria-hidden={stage !== 2}>
          <div className="urxo-intro-kicker"><span /> ГОТОВ НАЧАТЬ?</div>
          <h2>Твоя следующая<br /><em>сделка — это опыт.</em></h2>
          <p className="urxo-intro-info-lead">Заходи в URXO. Выбирай рынок, анализируй график и тренируй собственную систему.</p>
          <button type="button" className="urxo-intro-cta" onClick={() => setEntered(true)}>
            Войти в приложение <ArrowRight size={17} />
          </button>
          <div className="urxo-intro-scene-index">03 <i /> 03</div>
        </section>
      </main>

      <div className="urxo-intro-bottom">
        <span>TRAIN YOUR PROCESS. NOT YOUR LUCK.</span>
        <div className="urxo-intro-progress" aria-label={"Этап " + (stage + 1) + " из 3"}>
          {[0, 1, 2].map((item) => <i key={item} className={item <= stage ? "active" : ""} />)}
        </div>
        <span>BUILT FOR DISCIPLINED TRADERS <b>●</b></span>
      </div>
    </div>
  );
}

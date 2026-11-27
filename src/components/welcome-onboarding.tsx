"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, CandlestickChart, ChartNoAxesCombined, Clock3, X } from "lucide-react";

const STORAGE_KEY = "urxo-welcome-seen";

const slides = [
  {
    eyebrow: "WELCOME TO YOUR TRADING LAB",
    title: "Добро пожаловать в URXO",
    description: "Твоя площадка для практики, экспериментов и развития торгового мышления — без риска реальными деньгами.",
    icon: Activity,
    points: ["Исторические рынки вместо случайных сценариев", "Твои решения и результат — под контролем", "Практика в собственном темпе"],
  },
  {
    eyebrow: "ЗАЧЕМ НУЖЕН URXO",
    title: "Тренируйся на истории рынка",
    description: "Возвращайся к реальным движениям цены, проверяй торговые идеи и учись принимать решения в условиях, похожих на рынок.",
    icon: CandlestickChart,
    points: ["Изучай графики и переключай таймфреймы", "Открывай сделки и управляй Take Profit / Stop Loss", "Разбирай результат и находи закономерности"],
  },
  {
    eyebrow: "ТВОЙ ПУТЬ",
    title: "От первой сделки к системе",
    description: "Начни с тренировочной сессии, а затем отслеживай прогресс. URXO сохраняет результаты, чтобы ты видел не только отдельные сделки, но и общую картину.",
    icon: ChartNoAxesCombined,
    points: ["Training — торговая практика", "Statistics — прогресс и метрики", "History — сделки и их разбор"],
  },
];

export default function WelcomeOnboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
    setReady(true);
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // The welcome screen can still be dismissed when storage is unavailable.
    }
    setVisible(false);
  }

  if (!ready || !visible) return null;

  const slide = slides[step];
  const SlideIcon = slide.icon;

  return (
    <div className="urxo-welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="urxo-welcome-title">
      <div className="urxo-welcome-panel">
        <button type="button" onClick={finish} className="urxo-welcome-close" aria-label="Закрыть приветствие">
          <X size={18} />
        </button>

        <div className="urxo-welcome-visual">
          <div className="urxo-welcome-orbit urxo-welcome-orbit-one" />
          <div className="urxo-welcome-orbit urxo-welcome-orbit-two" />
          <div className="urxo-welcome-grid" />
          <div className="urxo-welcome-brand"><Activity size={19} /><span>URXO</span><small>TRADING LAB</small></div>
          <svg className="urxo-welcome-chart" viewBox="0 0 620 190" role="img" aria-label="Абстрактный график движения цены">
            <defs>
              <linearGradient id="urxo-chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity=".22" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 148 L40 135 L78 145 L112 102 L150 117 L188 76 L225 91 L262 55 L300 72 L337 38 L375 63 L414 25 L452 47 L490 17 L530 38 L570 9 L620 20 L620 190 L0 190 Z" fill="url(#urxo-chart-fill)" />
            <path d="M0 148 L40 135 L78 145 L112 102 L150 117 L188 76 L225 91 L262 55 L300 72 L337 38 L375 63 L414 25 L452 47 L490 17 L530 38 L570 9 L620 20" fill="none" stroke="#f4f4f5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0 170 H620" stroke="white" strokeOpacity=".14" strokeDasharray="4 8" />
            <path d="M0 110 H620" stroke="white" strokeOpacity=".1" strokeDasharray="4 8" />
          </svg>
          <div className="urxo-welcome-visual-caption"><span>MARKET REPLAY</span><span>LEARN · TEST · IMPROVE</span></div>
        </div>

        <div className="urxo-welcome-content" key={step}>
          <div className="urxo-welcome-eyebrow"><span />{slide.eyebrow}</div>
          <div className="urxo-welcome-heading-row">
            <div className="urxo-welcome-step-icon"><SlideIcon size={22} /></div>
            <h2 id="urxo-welcome-title">{slide.title}</h2>
          </div>
          <p className="urxo-welcome-description">{slide.description}</p>
          <ul className="urxo-welcome-points">
            {slide.points.map((point) => <li key={point}><span><ArrowRight size={13} /></span>{point}</li>)}
          </ul>

          <div className="urxo-welcome-footer">
            <div className="urxo-welcome-progress" aria-label={`Шаг ${step + 1} из ${slides.length}`}>
              {slides.map((item, index) => <span key={item.eyebrow} className={index <= step ? "active" : ""} />)}
            </div>
            <div className="urxo-welcome-actions">
              {step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)} className="urxo-welcome-back">Назад</button>}
              <button type="button" onClick={() => step === slides.length - 1 ? finish() : setStep((current) => current + 1)} className="urxo-welcome-next">
                {step === slides.length - 1 ? "Начать работу" : "Далее"} <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <button type="button" onClick={finish} className="urxo-welcome-skip">Пропустить знакомство</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, Crosshair } from "lucide-react";

type IntroStage = 0 | 1 | 2;

export default function WelcomeOnboarding() {
  const [stage, setStage] = useState<IntroStage>(0);
  const [exitingStage, setExitingStage] = useState<IntroStage | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const firstTimer = window.setTimeout(() => {
      setExitingStage(0);
      setStage(1);
    }, 1500);
    const secondTimer = window.setTimeout(() => {
      setExitingStage(1);
      setStage(2);
    }, 3000);

    return () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
    };
  }, []);

  if (entered) return null;

  const sceneClass = (index: IntroStage) => {
    if (stage === index) return "is-visible";
    if (exitingStage === index) return "is-exiting";
    return "";
  };

  return (
    <div className="urxo-intro" role="dialog" aria-modal="true" aria-labelledby="urxo-intro-title">
      <main className="urxo-intro-main">
        <section className={"urxo-intro-scene " + sceneClass(0)} aria-hidden={stage !== 0}>
          <h1 id="urxo-intro-title">Добро пожаловать</h1>
          <div className="urxo-intro-welcome-brand">в <em>URXO.</em></div>
        </section>

        <section className={"urxo-intro-scene urxo-intro-info " + sceneClass(1)} aria-hidden={stage !== 1}>
          <h2>Рынок. Опыт. <em>Твой прогресс.</em></h2>
          <p className="urxo-intro-info-lead">
            URXO — торговый тренажёр на исторических рыночных данных. Учись читать график
            и оттачивай торговые решения без риска реальными деньгами.
          </p>
          <div className="urxo-intro-features">
            <div><BarChart3 /><span><b>Исторические данные</b><small>Изучай реальные движения рынка</small></span></div>
            <div><Crosshair /><span><b>Практика сделок</b><small>Открывай позиции, выставляй стоп и тейк</small></span></div>
          </div>
        </section>

        <section className={"urxo-intro-scene urxo-intro-entry " + sceneClass(2)} aria-hidden={stage !== 2}>
          <h2>Твоя следующая<br /><em>сделка — это опыт.</em></h2>
          <p className="urxo-intro-info-lead">
            Заходи в URXO. Выбирай рынок, анализируй график и тренируй собственную систему.
          </p>
          <button type="button" className="urxo-intro-cta" onClick={() => setEntered(true)}>
            Войти в приложение <ArrowRight size={17} />
          </button>
        </section>
      </main>
    </div>
  );
}

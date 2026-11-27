import Link from "next/link";
import {
  Activity, ArrowLeft, BarChart3, CandlestickChart, Clock3, Database,
  Palette, Settings, ShieldCheck, TrendingUp, Wallet,
} from "lucide-react";

const sections = [
  { id: "overview", title: "Что такое URXO", description: "Знакомство с тренажёром" },
  { id: "pages", title: "Страницы сайта", description: "Куда ведут разделы меню" },
  { id: "training", title: "Торговый тренажёр", description: "График, инструменты и сделки" },
  { id: "orders", title: "Ордера и управление сделкой", description: "Market, Limit, TP и SL" },
  { id: "scoring", title: "Очки и результаты", description: "Как формируется результат" },
  { id: "settings", title: "Настройки и внешний вид", description: "Что можно поменять" },
  { id: "data", title: "Исторические данные", description: "Откуда берутся свечи" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold tracking-tight">{children}</h2>;
}

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/[0.08] px-5 py-5 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft size={17} /> На главную
          </Link>
          <div className="flex items-center gap-2 text-xs text-zinc-500"><Activity size={16} /> URXO TRADING LAB</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:px-10 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-white/[0.08] bg-[#111111] p-5 lg:sticky lg:top-8">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Содержание</p>
          <nav className="space-y-1">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
                {section.title}
              </a>
            ))}
          </nav>
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <Link href="/settings" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><Settings size={15}/> Настройки</Link>
          </div>
        </aside>

        <article className="min-w-0">
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500">HELP CENTER</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Центр помощи URXO</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
              Здесь собрана инструкция по сайту: назначение разделов, работа с историческим графиком,
              открытие и сопровождение сделок, система очков и настройки. Документация будет постепенно
              дополняться по мере развития тренажёра.
            </p>
          </div>

          <section id="overview" className="scroll-mt-8 border-b border-white/[0.08] pb-9">
            <div className="mb-4 flex items-center gap-3"><ShieldCheck className="text-zinc-300" size={21}/><SectionTitle>Что такое URXO</SectionTitle></div>
            <p className="text-sm leading-7 text-zinc-400">
              URXO — тренировочная площадка для практики торговли на исторических рыночных данных.
              Ты выбираешь инструмент и период, наблюдаешь за движением цены в режиме воспроизведения
              и принимаешь торговые решения, не рискуя реальными деньгами. Рынок не генерируется
              случайным образом: тренажёр показывает исторические свечи, постепенно раскрывая их по ходу сессии.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Основная задача — тренировать анализ графика, планирование входа, выбор стоп-лосса
              и тейк-профита, а затем разбирать свои результаты.
            </p>
          </section>

          <section id="pages" className="scroll-mt-8 border-b border-white/[0.08] py-9">
            <div className="mb-5 flex items-center gap-3"><Activity className="text-zinc-300" size={21}/><SectionTitle>Страницы сайта</SectionTitle></div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
                <div className="flex items-center gap-2 font-semibold"><Activity size={17}/> Dashboard — Главная панель</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Стартовая страница. Здесь отображаются сводные показатели аккаунта, баланс очков, количество сделок и процент прибыльных сделок. Отсюда можно перейти к тренировке и управлению загрузкой исторических данных.</p>
                <Link href="/" className="mt-3 inline-block text-xs text-zinc-300 underline underline-offset-4">Открыть Dashboard</Link>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
                <div className="flex items-center gap-2 font-semibold"><CandlestickChart size={17}/> Training — Торговый тренажёр</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Основное рабочее место. Здесь выбираются инструмент и таймфрейм, просматриваются свечи, делаются пометки, выставляются рыночные и отложенные ордера. После закрытия сделки можно перейти к её разбору.</p>
                <Link href="/training" className="mt-3 inline-block text-xs text-zinc-300 underline underline-offset-4">Открыть Training</Link>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
                <div className="flex items-center gap-2 font-semibold"><BarChart3 size={17}/> Statistics — Статистика</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Аналитика результатов: текущий баланс, чистый результат, win rate, максимальная просадка, кривая баланса, серия побед и среднее количество очков на сделку.</p>
                <Link href="/statistics" className="mt-3 inline-block text-xs text-zinc-300 underline underline-offset-4">Открыть Statistics</Link>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
                <div className="flex items-center gap-2 font-semibold"><Clock3 size={17}/> History — История сделок</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Список закрытых сделок с инструментом, таймфреймом, результатом TP/SL, RR, изменением очков и балансом после сделки. Нажатие на запись открывает график в режиме анализа.</p>
                <Link href="/history" className="mt-3 inline-block text-xs text-zinc-300 underline underline-offset-4">Открыть History</Link>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
                <div className="flex items-center gap-2 font-semibold"><Settings size={17}/> Settings — Настройки</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Настройка внешнего вида приложения: выбор светлой или тёмной темы. Выбранная тема сохраняется в браузере на этом устройстве.</p>
                <Link href="/settings" className="mt-3 inline-block text-xs text-zinc-300 underline underline-offset-4">Открыть Settings</Link>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
                <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={17}/> Help Center — Центр помощи</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Эта страница. Здесь находятся инструкции по разделам сайта и основным функциям.</p>
              </div>
            </div>
          </section>

          <section id="training" className="scroll-mt-8 border-b border-white/[0.08] py-9">
            <div className="mb-4 flex items-center gap-3"><CandlestickChart className="text-zinc-300" size={21}/><SectionTitle>Торговый тренажёр</SectionTitle></div>
            <div className="space-y-4 text-sm leading-7 text-zinc-400">
              <p><b className="text-zinc-200">Инструменты:</b> EUR/USD, Gold (XAU/USD) и NAS100. Выбор нового графика выполняется кнопкой следующего графика после завершения сделки или через Skip, если нужно пропустить текущий сценарий.</p>
              <p><b className="text-zinc-200">Таймфреймы:</b> MN1 — месячный, W1 — недельный, D1 — дневной, H4 — четырёхчасовой, H1 — часовой. Переключение таймфрейма меняет интервал одной свечи, сохраняя временную точку сессии.</p>
              <p><b className="text-zinc-200">Перемещение по графику:</b> перетаскивай график мышью, используй колесо для масштабирования. Кнопки «−» и «+» отдаляют и приближают график, кнопка Fit показывает доступную историю целиком.</p>
              <p><b className="text-zinc-200">Воспроизведение:</b> кнопки управления позволяют запускать и останавливать движение исторических свечей, менять скорость, перематывать и переходить по истории. Доступный участок графика постепенно расширяется по мере воспроизведения.</p>
              <p><b className="text-zinc-200">Пометки:</b> доступны курсор, линия, прямоугольник и текстовая заметка. Выбери инструмент на панели над графиком, затем работай непосредственно на графике. Выбранные объекты можно перемещать и изменять; Undo отменяет последнее действие, Clear удаляет пометки.</p>
              <p><b className="text-zinc-200">Разбор:</b> в разделе History нажми на закрытую сделку — тренажёр откроет тот же участок графика с сохранённой разметкой в режиме анализа.</p>
            </div>
          </section>

          <section id="orders" className="scroll-mt-8 border-b border-white/[0.08] py-9">
            <div className="mb-4 flex items-center gap-3"><TrendingUp className="text-zinc-300" size={21}/><SectionTitle>Ордера и управление сделкой</SectionTitle></div>
            <div className="space-y-4 text-sm leading-7 text-zinc-400">
              <p><b className="text-zinc-200">BUY MKT / SELL MKT:</b> открывают рыночную длинную или короткую позицию по текущей цене.</p>
              <p><b className="text-zinc-200">BUY LIMIT / SELL LIMIT:</b> создают отложенный ордер. После появления на графике его уровень входа можно перетаскивать. Позиция активируется, когда историческая цена касается уровня входа.</p>
              <p><b className="text-zinc-200">Long / Short:</b> у позиции есть точка входа, Take Profit (цель фиксации результата) и Stop Loss (уровень ограничения убытка). Перетаскивай соответствующие уровни и ручки на графике, чтобы менять параметры. Область прибыли и риска отображается разными заливками.</p>
              <p><b className="text-zinc-200">Очки до входа:</b> возле уровней TP и SL показывается расчётный результат в очках. Это предварительная оценка; итог фиксируется только после фактического закрытия позиции.</p>
              <p><b className="text-zinc-200">Ожидание лимитного ордера:</b> если воспроизведение дошло до напоминания, появится вопрос «Ваша идея ещё актуальна?». «Продолжить» оставляет ордер активным, «Не актуально» отменяет его. Если цена активирует лимитный ордер, можно подтвердить или скорректировать TP и SL перед продолжением воспроизведения.</p>
              <p>Сделка закрывается при первом достижении TP или SL исторической ценой. После этого результат сохраняется в History и учитывается в Statistics.</p>
            </div>
          </section>

          <section id="scoring" className="scroll-mt-8 border-b border-white/[0.08] py-9">
            <div className="mb-4 flex items-center gap-3"><Wallet className="text-zinc-300" size={21}/><SectionTitle>Очки и результаты</SectionTitle></div>
            <div className="space-y-4 text-sm leading-7 text-zinc-400">
              <p>Стартовый баланс тренажёра — <b className="text-zinc-200">100 очков</b>. Очки начисляются или списываются при закрытии сделки, а не при её открытии.</p>
              <p>Размер результата зависит от дистанции между входом и уровнем закрытия: чем дальше расположен TP или SL от входа, тем больше абсолютное изменение очков. Убыточная сделка списывает очки, прибыльная добавляет.</p>
              <p>Текущий баланс и сводные показатели доступны на Dashboard и в Statistics. Подробности каждой закрытой сделки находятся в History.</p>
              <p className="text-xs text-zinc-500">Правила начисления очков могут корректироваться по мере развития тренажёра; актуальные значения показываются прямо на графике и в результате закрытой сделки.</p>
            </div>
          </section>

          <section id="settings" className="scroll-mt-8 border-b border-white/[0.08] py-9">
            <div className="mb-4 flex items-center gap-3"><Palette className="text-zinc-300" size={21}/><SectionTitle>Настройки и внешний вид</SectionTitle></div>
            <div className="space-y-4 text-sm leading-7 text-zinc-400">
              <p>Открой <b className="text-zinc-200">Settings</b> в системном меню Dashboard. В блоке Appearance выбери Dark или Light. Настройка применяется ко всему приложению, включая график, и сохраняется на текущем устройстве.</p>
              <p>В самом тренажёре кнопка с шестерёнкой открывает быстрые настройки графика: Fit chart (сброс масштаба) и сброс активного инструмента рисования. Масштаб также можно менять кнопками над графиком, колесом мыши и перетаскиванием.</p>
              <Link href="/settings" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.06]"><Settings size={14}/> Перейти в настройки</Link>
            </div>
          </section>

          <section id="data" className="scroll-mt-8 py-9">
            <div className="mb-4 flex items-center gap-3"><Database className="text-zinc-300" size={21}/><SectionTitle>Исторические данные</SectionTitle></div>
            <div className="space-y-4 text-sm leading-7 text-zinc-400">
              <p>Для построения графиков используются исторические рыночные данные Dukascopy. На Dashboard находится блок Market Data: он показывает состояние локальных наборов данных и позволяет запустить загрузку архива 2024–2025 годов.</p>
              <p>Во время загрузки отображаются прогресс и статус по инструментам. Для полноценной тренировки нужный набор данных должен быть загружен и отмечен как Verified. Если набор отсутствует, неполный или повреждён, проверь статус на Dashboard и повтори загрузку.</p>
              <p>Тренажёр предназначен для обучения и симуляции на истории. Он не отправляет реальные ордера на биржу или брокеру и не является инвестиционной рекомендацией.</p>
            </div>
          </section>

          <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#111111] p-5">
            <h2 className="font-semibold">Документация будет расширяться</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">По мере появления новых функций сюда будут добавляться инструкции, пояснения элементов интерфейса и ответы на частые вопросы.</p>
            <Link href="/" className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200">Вернуться на Dashboard</Link>
          </div>
        </article>
      </div>
    </main>
  );
}

import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";

type Section = "home" | "info" | "tests" | "briefings" | "cabinet" | "checklists" | "contacts";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "home", label: "Главная", icon: "LayoutDashboard" },
  { id: "info", label: "Информация", icon: "BookOpen" },
  { id: "tests", label: "Тестирование", icon: "ClipboardCheck" },
  { id: "briefings", label: "Инструктажи", icon: "Users" },
  { id: "cabinet", label: "Личный кабинет", icon: "UserCircle" },
  { id: "checklists", label: "Чек-листы", icon: "ListChecks" },
  { id: "contacts", label: "Контакты", icon: "MessageSquare" },
];

const NEWS = [
  { tag: "Новость", date: "23 мая 2026", title: "Обновлены требования по электробезопасности", desc: "Приказ Минтруда №123 вступает в силу с 1 июня 2026 года." },
  { tag: "Справка", date: "20 мая 2026", title: "Требования к СИЗ на производстве", desc: "Обновлённый справочник по средствам индивидуальной защиты." },
  { tag: "Новость", date: "15 мая 2026", title: "Плановая проверка ГИТ: что нужно знать", desc: "Чек-лист для подготовки к проверке государственной инспекции." },
];

const TESTS = [
  { title: "Общие требования охраны труда", questions: 20, time: "30 мин", status: "passed", score: 90 },
  { title: "Пожарная безопасность", questions: 15, time: "20 мин", status: "pending", score: null },
  { title: "Электробезопасность. Группа II", questions: 25, time: "40 мин", status: "in_progress", score: null },
  { title: "Работа на высоте", questions: 18, time: "25 мин", status: "pending", score: null },
];

const BRIEFINGS = [
  { id: "intro", title: "Вводный инструктаж", desc: "Проводится при приёме на работу. Охватывает общие требования охраны труда.", duration: "45 мин", required: true, status: "done" },
  { id: "primary", title: "Первичный инструктаж", desc: "Инструктаж на рабочем месте перед допуском к самостоятельной работе.", duration: "30 мин", required: true, status: "done" },
  { id: "repeat", title: "Повторный инструктаж", desc: "Проводится не реже 1 раза в 6 месяцев для закрепления знаний.", duration: "30 мин", required: true, status: "due" },
  { id: "target", title: "Целевой инструктаж", desc: "Перед выполнением разовых работ, не связанных с основными обязанностями.", duration: "20 мин", required: false, status: "pending" },
];

const CHECKLISTS_DATA = [
  {
    title: "Рабочее место",
    items: [
      { text: "Рабочее место убрано и организовано", done: true },
      { text: "Освещение соответствует нормам", done: true },
      { text: "Проходы свободны от посторонних предметов", done: true },
      { text: "Огнетушитель в доступном месте", done: false },
    ],
  },
  {
    title: "Оборудование",
    items: [
      { text: "Оборудование технически исправно", done: true },
      { text: "Защитные ограждения установлены", done: false },
      { text: "Заземление проверено", done: true },
      { text: "Инструмент осмотрен перед работой", done: false },
    ],
  },
  {
    title: "СИЗ",
    items: [
      { text: "Каска соответствует требованиям", done: true },
      { text: "Спецодежда выдана и исправна", done: true },
      { text: "Защитные очки в наличии", done: false },
      { text: "Перчатки соответствуют виду работ", done: true },
    ],
  },
];

const STATS = [
  { label: "Пройдено тестов", value: "3", total: "8", icon: "ClipboardCheck" },
  { label: "Инструктажей", value: "2", total: "4", icon: "Users" },
  { label: "Чек-листов", value: "12", total: "15", icon: "ListChecks" },
  { label: "Дней до инструктажа", value: "14", total: null, icon: "Bell" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    passed: { label: "Пройден", color: "bg-green-100 text-green-700" },
    pending: { label: "Не начат", color: "bg-gray-100 text-gray-600" },
    in_progress: { label: "В процессе", color: "bg-blue-100 text-blue-700" },
    done: { label: "Выполнен", color: "bg-green-100 text-green-700" },
    due: { label: "Требуется", color: "bg-amber-100 text-amber-700" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function Index() {
  const [active, setActive] = useState<Section>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checklistState, setChecklistState] = useState(CHECKLISTS_DATA);
  const [notification, setNotification] = useState(true);

  const toggleItem = (ci: number, ii: number) => {
    setChecklistState(prev =>
      prev.map((c, i) =>
        i === ci
          ? { ...c, items: c.items.map((item, j) => j === ii ? { ...item, done: !item.done } : item) }
          : c
      )
    );
  };

  const resetChecklists = () => setChecklistState(CHECKLISTS_DATA.map(c => ({ ...c, items: c.items.map(i => ({ ...i, done: false })) })));

  const navigate = (id: Section) => {
    setActive(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background font-ibm flex flex-col">
      {notification && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Icon name="Bell" size={14} />
            <span className="font-medium">Напоминание:</span>
            <span>Повторный инструктаж по охране труда — через 14 дней (08.06.2026)</span>
          </div>
          <button onClick={() => setNotification(false)} className="text-amber-500 hover:text-amber-700 ml-4">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden mr-1" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Icon name="Menu" size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                <Icon name="ShieldCheck" size={14} className="text-white" />
              </div>
              <span className="font-semibold text-base tracking-tight">ОхранаТруд</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  active === item.id
                    ? "text-primary bg-primary/8 font-semibold"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
              <Icon name="Bell" size={15} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">ИВ</div>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setSidebarOpen(false)}>
          <div className="bg-white w-64 h-full shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6 mt-1">
              <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                <Icon name="ShieldCheck" size={14} className="text-white" />
              </div>
              <span className="font-semibold text-base">ОхранаТруд</span>
            </div>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mb-1 text-left ${
                  active === item.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <Icon name={item.icon} size={16} fallback="Circle" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">

        {active === "home" && (
          <div className="animate-fade-in space-y-8">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Добро пожаловать</p>
              <h1 className="text-2xl font-semibold text-foreground mb-1">Платформа охраны труда</h1>
              <p className="text-muted-foreground text-sm">Иванов Владимир · Специалист по ОТ · Отдел: Производство</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STATS.map((s, i) => (
                <div key={i} className="bg-white border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                      <Icon name={s.icon} size={15} className="text-primary" fallback="Circle" />
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{s.value}</div>
                  {s.total && <p className="text-xs text-muted-foreground mt-0.5">из {s.total} · {s.label}</p>}
                  {!s.total && <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>}
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-sm">Активные задачи</h2>
                  <span className="text-xs font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700">3 задачи</span>
                </div>
                <div className="space-y-1">
                  {[
                    { text: "Пройти повторный инструктаж", due: "08.06.2026", urgent: true },
                    { text: "Тест «Пожарная безопасность»", due: "15.06.2026", urgent: false },
                    { text: "Тест «Работа на высоте»", due: "30.06.2026", urgent: false },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${t.urgent ? "bg-amber-500" : "bg-blue-400"}`} />
                        <span className="text-sm">{t.text}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{t.due}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-border rounded-lg p-5">
                <h2 className="font-semibold text-sm mb-4">Прогресс обучения</h2>
                <div className="space-y-4">
                  {[
                    { label: "Тестирование", value: 38 },
                    { label: "Инструктажи", value: 50 },
                    { label: "Чек-листы", value: 80 },
                  ].map((p, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{p.label}</span>
                        <span className="font-medium">{p.value}%</span>
                      </div>
                      <Progress value={p.value} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm">Последние новости</h2>
                <button onClick={() => navigate("info")} className="text-xs text-primary hover:underline">Все новости →</button>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {NEWS.map((n, i) => (
                  <div key={i} className="border border-border rounded-md p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">{n.tag}</span>
                      <span className="text-xs text-muted-foreground">{n.date}</span>
                    </div>
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {active === "info" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Информация</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Новости и справочные материалы по охране труда</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {["Все", "Новости", "Нормативы", "Справочники", "Приказы"].map((f, i) => (
                <button key={f} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${i === 0 ? "bg-primary text-white border-primary" : "border-border hover:bg-muted text-foreground"}`}>{f}</button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ...NEWS,
                { tag: "Норматив", date: "10 мая 2026", title: "ГОСТ 12.0.230-2007 ССБТ", desc: "Системы управления охраной труда. Общие требования." },
                { tag: "Приказ", date: "5 мая 2026", title: "Приказ №772н Минтруда РФ", desc: "Требования к обучению по охране труда." },
                { tag: "Справка", date: "1 мая 2026", title: "Классификация вредных факторов", desc: "Физические, химические, биологические и психофизиологические факторы производственной среды." },
              ].map((n, i) => (
                <div key={i} className="bg-white border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">{n.tag}</span>
                    <span className="text-xs text-muted-foreground">{n.date}</span>
                  </div>
                  <h3 className="font-medium text-sm mb-1.5 leading-snug">{n.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.desc}</p>
                  <button className="mt-3 text-xs text-primary hover:underline">Читать →</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === "tests" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Тестирование</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Программы обучения по охране труда</p>
            </div>

            <div className="grid gap-3">
              {TESTS.map((t, i) => (
                <div key={i} className="bg-white border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:shadow-md">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={t.status} />
                      {t.score && <span className="text-xs text-muted-foreground">Результат: <strong>{t.score}%</strong></span>}
                    </div>
                    <h3 className="font-medium text-sm mb-1">{t.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Icon name="HelpCircle" size={12} fallback="Circle" />{t.questions} вопросов</span>
                      <span className="flex items-center gap-1"><Icon name="Clock" size={12} fallback="Circle" />{t.time}</span>
                    </div>
                  </div>
                  <button className={`px-4 py-2 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                    t.status === "passed"
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}>
                    {t.status === "passed" ? "Пройти повторно" : t.status === "in_progress" ? "Продолжить" : "Начать тест"}
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Icon name="Info" size={16} className="text-blue-600 mt-0.5 shrink-0" fallback="Circle" />
              <p className="text-sm text-blue-800">Для допуска к работе необходимо пройти все обязательные тесты с результатом не менее <strong>80%</strong>. Тесты можно пересдавать неограниченное число раз.</p>
            </div>
          </div>
        )}

        {active === "briefings" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Инструктажи</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Виды инструктажей по охране труда</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {BRIEFINGS.map((b, i) => (
                <div key={i} className={`bg-white border rounded-lg p-5 transition-all duration-200 hover:shadow-md ${b.status === "due" ? "border-amber-300" : "border-border"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={b.status} />
                      {b.required && (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Обязательный</span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap ml-2">
                      <Icon name="Clock" size={12} fallback="Circle" />{b.duration}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base mb-2">{b.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{b.desc}</p>
                  <button className={`w-full py-2 text-sm rounded-md font-medium transition-colors ${
                    b.status === "done"
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : b.status === "due"
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}>
                    {b.status === "done" ? "Пройден — просмотреть" : b.status === "due" ? "Пройти (требуется)" : "Начать инструктаж"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === "cabinet" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Личный кабинет</p>
              <h1 className="text-2xl font-semibold">Моё обучение</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1 bg-white border border-border rounded-lg p-5">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mb-3">ИВ</div>
                  <h2 className="font-semibold">Иванов Владимир</h2>
                  <p className="text-sm text-muted-foreground">Специалист по ОТ</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Отдел: Производство</p>
                  <div className="mt-4 w-full pt-4 border-t border-border space-y-2.5 text-left">
                    {[
                      { label: "Дата приёма", value: "12.03.2024" },
                      { label: "Группа по ЭБ", value: "II" },
                      { label: "Следующий инструктаж", value: "08.06.2026" },
                    ].map((r, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="font-medium">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="bg-white border border-border rounded-lg p-5">
                  <h2 className="font-semibold text-sm mb-4">Статистика обучения</h2>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Тестов пройдено", value: "3/8", icon: "ClipboardCheck" },
                      { label: "Инструктажей", value: "2/4", icon: "Users" },
                      { label: "Средний балл", value: "87%", icon: "TrendingUp" },
                    ].map((s, i) => (
                      <div key={i} className="text-center p-3 bg-muted/50 rounded-lg">
                        <Icon name={s.icon} size={18} className="text-primary mx-auto mb-1.5" fallback="Circle" />
                        <div className="font-semibold text-base">{s.value}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Общий прогресс обучения", value: 55 },
                      { label: "Обязательные инструктажи", value: 50 },
                      { label: "Тестирование", value: 38 },
                    ].map((p, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">{p.label}</span>
                          <span className="font-medium">{p.value}%</span>
                        </div>
                        <Progress value={p.value} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-border rounded-lg p-5">
                  <h2 className="font-semibold text-sm mb-3">История действий</h2>
                  <div className="space-y-1">
                    {[
                      { action: "Пройден тест", detail: "Общие требования охраны труда — 90%", date: "20.05.2026", icon: "ClipboardCheck", color: "text-green-600" },
                      { action: "Вводный инструктаж", detail: "Завершён и подписан", date: "12.03.2024", icon: "CheckCircle", color: "text-green-600" },
                      { action: "Первичный инструктаж", detail: "Завершён и подписан", date: "12.03.2024", icon: "CheckCircle", color: "text-green-600" },
                    ].map((a, i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                        <Icon name={a.icon} size={15} className={a.color} fallback="Circle" />
                        <div className="flex-1 text-sm">
                          <span className="font-medium">{a.action}</span>
                          <span className="text-muted-foreground"> — {a.detail}</span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{a.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {active === "checklists" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Чек-листы</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Проверки перед началом работы</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {checklistState.map((cl, ci) => {
                const done = cl.items.filter(i => i.done).length;
                const pct = Math.round((done / cl.items.length) * 100);
                return (
                  <div key={ci} className="bg-white border border-border rounded-lg p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-semibold text-sm">{cl.title}</h2>
                      <span className={`text-xs font-medium ${pct === 100 ? "text-green-600" : "text-muted-foreground"}`}>{done}/{cl.items.length}</span>
                    </div>
                    <div className="mb-4">
                      <Progress value={pct} className="h-1" />
                    </div>
                    <div className="space-y-2.5">
                      {cl.items.map((item, ii) => (
                        <div key={ii} className="flex items-start gap-2.5 cursor-pointer group" onClick={() => toggleItem(ci, ii)}>
                          <div className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                            item.done ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                          }`}>
                            {item.done && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                          </div>
                          <span className={`text-sm leading-snug select-none ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                    {pct === 100 && (
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">
                        <Icon name="CheckCircle" size={13} fallback="Check" />
                        Все пункты выполнены
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-border rounded-lg p-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Прогресс на сегодня: </span>
                <span className="text-muted-foreground">
                  {checklistState.reduce((acc, cl) => acc + cl.items.filter(i => i.done).length, 0)} из{" "}
                  {checklistState.reduce((acc, cl) => acc + cl.items.length, 0)} пунктов выполнено
                </span>
              </div>
              <button onClick={resetChecklists} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <Icon name="RotateCcw" size={12} fallback="Circle" />
                Сбросить всё
              </button>
            </div>
          </div>
        )}

        {active === "contacts" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Контакты</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Служба охраны труда и поддержка</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-border rounded-lg p-5 space-y-4">
                <h2 className="font-semibold text-sm">Служба охраны труда</h2>
                {[
                  { icon: "User", label: "Специалист по ОТ", value: "Петрова Марина Сергеевна" },
                  { icon: "Phone", label: "Телефон", value: "+7 (495) 123-45-67 доб. 201" },
                  { icon: "Mail", label: "E-mail", value: "ot@company.ru" },
                  { icon: "MapPin", label: "Кабинет", value: "Корпус А, каб. 214" },
                  { icon: "Clock", label: "Приём", value: "Пн–Пт, 9:00–17:00" },
                ].map((c, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
                      <Icon name={c.icon} size={13} className="text-primary" fallback="Circle" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-sm font-medium mt-0.5">{c.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-border rounded-lg p-5">
                  <h2 className="font-semibold text-sm mb-4">Написать обращение</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Тема обращения</label>
                      <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                        <option>Вопрос по инструктажу</option>
                        <option>Вопрос по тестированию</option>
                        <option>Сообщить об опасности</option>
                        <option>Другое</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Сообщение</label>
                      <textarea className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground resize-none h-24" placeholder="Опишите ваш вопрос..." />
                    </div>
                    <button className="w-full bg-primary text-white py-2 text-sm rounded-md font-medium hover:bg-primary/90 transition-colors">
                      Отправить
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <Icon name="AlertTriangle" size={16} className="text-amber-600 mt-0.5 shrink-0" fallback="Circle" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Экстренная ситуация?</p>
                    <p className="text-xs text-amber-700 mt-0.5">Вызов экстренных служб: <strong>112</strong></p>
                    <p className="text-xs text-amber-700">Внутренняя служба безопасности: <strong>доб. 911</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="ShieldCheck" size={14} className="text-primary" fallback="Shield" />
            <span>ОхранаТруд · Платформа обучения по охране труда</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 · Все права защищены</p>
        </div>
      </footer>
    </div>
  );
}
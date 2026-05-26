import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { TESTS_DATA, type TestData } from "@/data/tests";
import { BRIEFINGS_DATA } from "@/data/briefings";
import BriefingPlayer from "@/components/BriefingPlayer";
import {
  DOCUMENTS_DATA,
  TEMPLATES_DATA,
  SOUT_TEMPLATES,
  PROFRISK_TEMPLATES,
  type Template,
} from "@/data/infoData";
import TemplateEditor from "@/components/TemplateEditor";
import AuthModal from "@/components/AuthModal";
import CabinetPanel from "@/components/CabinetPanel";
import EmployerPanel from "@/components/EmployerPanel";
import DocumentsUploader from "@/components/DocumentsUploader";
import CompanyDocsList from "@/components/CompanyDocsList";
import CompanyContacts from "@/components/CompanyContacts";
import { useAuth } from "@/contexts/AuthContext";

const NEWS_URL = "https://functions.poehali.dev/c3136b62-f96f-4c75-a5cf-4c4a43cad9db";

interface NewsItem {
  tag: string;
  title: string;
  description: string;
  url: string;
  date: string;
}

type Section = "home" | "info" | "tests" | "briefings" | "cabinet" | "employer" | "checklists" | "contacts";
type TestMode = "list" | "running" | "results";

const NAV_ITEMS: { id: Section; label: string; icon: string; employerOnly?: boolean }[] = [
  { id: "home", label: "Главная", icon: "LayoutDashboard" },
  { id: "info", label: "Информация", icon: "BookOpen" },
  { id: "tests", label: "Тестирование", icon: "ClipboardCheck" },
  { id: "briefings", label: "Инструктажи", icon: "Users" },
  { id: "checklists", label: "Чек-листы", icon: "ListChecks" },
  { id: "contacts", label: "Контакты", icon: "MessageSquare" },
  { id: "employer", label: "Сотрудники", icon: "Building2", employerOnly: true },
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
    failed: { label: "Не пройден", color: "bg-red-100 text-red-600" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
      {s.label}
    </span>
  );
}

function EmployerSection() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"staff" | "docs">("staff");
  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Панель работодателя</p>
        <h1 className="text-2xl font-semibold">Управление</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{user?.company_name}</p>
      </div>
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { id: "staff", label: "Сотрудники и тесты", icon: "Users" },
          { id: "docs", label: "Документы СОУТ / ПрофРиски", icon: "Files" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon name={t.icon} size={14} fallback="Circle" />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "staff" && <EmployerPanel />}
      {tab === "docs" && <DocumentsUploader />}
    </div>
  );
}

function LogoutButton({ onDone }: { onDone: () => void }) {
  const { logout } = useAuth();
  return (
    <button
      onClick={async () => { await logout(); onDone(); }}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted text-red-600 transition-colors text-left"
    >
      <Icon name="LogOut" size={15} fallback="Circle" />
      Выйти
    </button>
  );
}

export default function Index() {
  const { user, unreadCount, loading: authLoading, completeTest } = useAuth();
  const [authModal, setAuthModal] = useState<false | "login" | "register">(false);
  const [avatarMenu, setAvatarMenu] = useState(false);

  const [active, setActive] = useState<Section>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checklistState, setChecklistState] = useState(CHECKLISTS_DATA);
  const [notification, setNotification] = useState(true);

  // News state
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsFilter, setNewsFilter] = useState("Все");

  useEffect(() => {
    fetch(NEWS_URL)
      .then(r => r.json())
      .then(data => setNews(data.news || []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, []);

  const newsFilters = ["Все", "Новость", "Надзор", "Мероприятие"];
  const filteredNews = newsFilter === "Все" ? news : news.filter(n => n.tag === newsFilter);

  // Info section tabs
  const INFO_TABS = ["Новости", "Документация", "Справочники", "Мои СОУТ", "ПрофРиски"] as const;
  type InfoTab = typeof INFO_TABS[number];
  const [infoTab, setInfoTab] = useState<InfoTab>("Новости");
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const switchInfoTab = (tab: InfoTab) => { setInfoTab(tab); setEditTemplate(null); setAddingTemplate(false); };
  const [openDocGroup, setOpenDocGroup] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<Template[]>(() => {
    try { return JSON.parse(localStorage.getItem("userTemplates") || "[]"); } catch { return []; }
  });
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplContent, setNewTplContent] = useState("");

  useEffect(() => {
    localStorage.setItem("userTemplates", JSON.stringify(userTemplates));
  }, [userTemplates]);

  const addUserTemplate = () => {
    if (!newTplTitle.trim()) return;
    setUserTemplates(prev => [...prev, {
      id: `user_${Date.now()}`,
      title: newTplTitle.trim(),
      description: "Добавлен вами",
      category: "Мои шаблоны",
      content: newTplContent,
      fields: [],
    }]);
    setNewTplTitle("");
    setNewTplContent("");
    setAddingTemplate(false);
  };

  // Briefing state
  const [activeBriefingId, setActiveBriefingId] = useState<string | null>(null);
  const [completedBriefings, setCompletedBriefings] = useState<Set<string>>(new Set(["intro", "primary"]));

  const completeBriefing = (id: string) => {
    setCompletedBriefings(prev => { const s = new Set(prev); s.add(id); return s; });
  };

  // Test state
  const [testMode, setTestMode] = useState<TestMode>("list");
  const [activeTest, setActiveTest] = useState<TestData | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [completedTests, setCompletedTests] = useState<Record<string, number>>({});

  const startTest = (test: TestData) => {
    setActiveTest(test);
    setCurrentQ(0);
    setAnswers({});
    setTestMode("running");
  };

  const selectAnswer = (qIndex: number, optIndex: number) => {
    setAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
  };

  const finishTest = () => {
    if (!activeTest) return;
    const correct = activeTest.questions.filter((q, i) => answers[i] === q.correct).length;
    const score = Math.round((correct / activeTest.questions.length) * 100);
    setCompletedTests(prev => ({ ...prev, [activeTest.id]: score }));
    setTestMode("results");
    // Сохраняем результат если назначен работодателем
    if (user) completeTest(activeTest.id, score);
  };

  const exitTest = () => {
    setTestMode("list");
    setActiveTest(null);
    setAnswers({});
    setCurrentQ(0);
  };

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

  const navigate = (id: Section, opts?: { briefingId?: string; infoTab?: typeof INFO_TABS[number] }) => {
    setActive(id);
    setSidebarOpen(false);
    if (opts?.briefingId) setActiveBriefingId(opts.briefingId);
    if (opts?.infoTab) switchInfoTab(opts.infoTab);
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
              <img
                src="https://cdn.poehali.dev/projects/cd71ce52-bb4a-42e1-b3e8-36fe92953b9e/bucket/f6918456-1a71-48db-8e71-dd06833a8284.png"
                alt="Логотип"
                className="w-8 h-8 object-contain rounded-full"
              />
              <span className="font-semibold text-base tracking-tight hidden sm:block">ОхранаТруда-Безопасность</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.filter(item => !item.employerOnly || user?.role === "employer").map(item => (
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
            {/* Колокол уведомлений */}
            {user && (
              <button
                onClick={() => navigate("cabinet")}
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary relative"
              >
                <Icon name="Bell" size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Аватар / кнопка входа */}
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setAvatarMenu(v => !v)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  {user.fio.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </button>
                {avatarMenu && (
                  <div className="absolute right-0 top-10 z-50 bg-white border border-border rounded-xl shadow-xl w-52 py-1 animate-fade-in">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="font-medium text-sm truncate">{user.fio}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <button onClick={() => { navigate("cabinet"); setAvatarMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                      <Icon name="UserCircle" size={15} fallback="Circle" />
                      Личный кабинет
                    </button>
                    {user.role === "employer" && (
                      <button onClick={() => { navigate("employer"); setAvatarMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                        <Icon name="Building2" size={15} fallback="Circle" />
                        Панель работодателя
                      </button>
                    )}
                    <div className="border-t border-border mt-1">
                      <LogoutButton onDone={() => { setAvatarMenu(false); navigate("home"); }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModal("login")}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
              >
                <Icon name="LogIn" size={14} fallback="Circle" />
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setSidebarOpen(false)}>
          <div className="bg-white w-64 h-full shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6 mt-1">
              <img
                src="https://cdn.poehali.dev/projects/cd71ce52-bb4a-42e1-b3e8-36fe92953b9e/bucket/f6918456-1a71-48db-8e71-dd06833a8284.png"
                alt="Логотип"
                className="w-8 h-8 object-contain rounded-full"
              />
              <span className="font-semibold text-sm leading-tight">ОхранаТруда-<br/>Безопасность</span>
            </div>
            {NAV_ITEMS.filter(item => !item.employerOnly || user?.role === "employer").map(item => (
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
            <div className="border-t border-border mt-2 pt-2">
              {user ? (
                <button onClick={() => navigate("cabinet")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mb-1 text-left hover:bg-muted">
                  <Icon name="UserCircle" size={16} fallback="Circle" />
                  Личный кабинет
                </button>
              ) : (
                <button onClick={() => { setSidebarOpen(false); setAuthModal("login"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-primary font-medium text-left">
                  <Icon name="LogIn" size={16} fallback="Circle" />
                  Войти / Регистрация
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">

        {active === "home" && (
          <div className="animate-fade-in space-y-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Добро пожаловать</p>
                <h1 className="text-2xl font-semibold text-foreground mb-1">Платформа охраны труда</h1>
                {user ? (
                  <p className="text-muted-foreground text-sm">
                    {user.fio} · {user.role === "employer" ? "Работодатель" : "Сотрудник"}
                    {user.company_name && ` · ${user.company_name}`}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">Войдите или зарегистрируйтесь для полного доступа</p>
                )}
              </div>
              {!user && (
                <div className="flex gap-2">
                  <button onClick={() => setAuthModal("login")}
                    className="px-4 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors font-medium">
                    Войти
                  </button>
                  <button onClick={() => setAuthModal("register")}
                    className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium">
                    Регистрация
                  </button>
                </div>
              )}
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
                    {
                      text: "Пройти повторный инструктаж",
                      due: "08.06.2026",
                      urgent: true,
                      action: () => navigate("briefings", { briefingId: "repeat" }),
                    },
                    {
                      text: "Тест «Пожарная безопасность»",
                      due: "15.06.2026",
                      urgent: false,
                      action: () => {
                        const t = TESTS_DATA.find(t => t.id === "fire");
                        if (t) { navigate("tests"); setTimeout(() => startTest(t), 50); }
                        else navigate("tests");
                      },
                    },
                    {
                      text: "Тест «Работа на высоте»",
                      due: "30.06.2026",
                      urgent: false,
                      action: () => {
                        const t = TESTS_DATA.find(t => t.id === "height");
                        if (t) { navigate("tests"); setTimeout(() => startTest(t), 50); }
                        else navigate("tests");
                      },
                    },
                  ].map((t, i) => (
                    <button
                      key={i}
                      onClick={t.action}
                      className="w-full flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors group text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${t.urgent ? "bg-amber-500" : "bg-blue-400"}`} />
                        <span className="text-sm group-hover:text-primary transition-colors">{t.text}</span>
                        <Icon name="ChevronRight" size={13} className="text-muted-foreground group-hover:text-primary transition-colors" fallback="Circle" />
                      </div>
                      <span className={`text-xs whitespace-nowrap ml-2 ${t.urgent ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>{t.due}</span>
                    </button>
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
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm">Последние новости Минтруда</h2>
                  {!newsLoading && news.length > 0 && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                      Обновлено сегодня
                    </span>
                  )}
                </div>
                <button onClick={() => navigate("info")} className="text-xs text-primary hover:underline">Все новости →</button>
              </div>
              {newsLoading ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="border border-border rounded-md p-3 animate-pulse">
                      <div className="h-3 bg-muted rounded w-20 mb-2"></div>
                      <div className="h-4 bg-muted rounded w-full mb-1"></div>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {news.slice(0, 3).map((n, i) => (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                      className="border border-border rounded-md p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer block">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">{n.tag}</span>
                        <span className="text-xs text-muted-foreground">{n.date}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {active === "info" && (
          <div className="animate-fade-in space-y-5">
            {/* Заголовок */}
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Информация</h1>
            </div>

            {/* Вкладки */}
            <div className="flex gap-1 flex-wrap border-b border-border pb-0">
              {INFO_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => switchInfoTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
                    infoTab === tab
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── НОВОСТИ ── */}
            {infoTab === "Новости" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    {newsFilters.map(f => (
                      <button key={f} onClick={() => setNewsFilter(f)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          newsFilter === f ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"
                        }`}>{f}</button>
                    ))}
                  </div>
                  <a href="https://mintrud.gov.ru/labour/safety" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors whitespace-nowrap">
                    <Icon name="ExternalLink" size={12} fallback="Circle" />
                    mintrud.gov.ru
                  </a>
                </div>

                {newsLoading ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="bg-white border border-border rounded-lg p-4 animate-pulse">
                        <div className="flex gap-2 mb-3"><div className="h-4 bg-muted rounded w-16"></div><div className="h-4 bg-muted rounded w-20"></div></div>
                        <div className="h-4 bg-muted rounded w-full mb-1.5"></div><div className="h-4 bg-muted rounded w-4/5 mb-1.5"></div>
                        <div className="h-3 bg-muted rounded w-full mt-3"></div><div className="h-3 bg-muted rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredNews.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Icon name="Newspaper" size={36} className="mx-auto mb-3 opacity-30" fallback="Circle" />
                    <p className="text-sm">Нет новостей по выбранной категории</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNews.map((n, i) => (
                      <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                        className="bg-white border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col group">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">{n.tag}</span>
                          <span className="text-xs text-muted-foreground">{n.date}</span>
                        </div>
                        <h3 className="font-medium text-sm mb-2 leading-snug flex-1 group-hover:text-primary transition-colors">{n.title}</h3>
                        {n.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{n.description}</p>}
                        <span className="mt-3 text-xs text-primary flex items-center gap-1">На сайте Минтруда <Icon name="ExternalLink" size={10} fallback="Circle" /></span>
                      </a>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                  <Icon name="RefreshCw" size={12} fallback="Circle" />
                  <span>Обновляется каждый день из RSS-ленты Минтруда России</span>
                </div>
              </div>
            )}

            {/* ── ДОКУМЕНТАЦИЯ ── */}
            {infoTab === "Документация" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Основные действующие нормативные документы по охране труда в РФ. Ссылки ведут на полный текст в системе КонсультантПлюс.</p>
                {DOCUMENTS_DATA.map(group => (
                  <div key={group.id} className={`rounded-xl border ${group.color} overflow-hidden`}>
                    <button
                      onClick={() => setOpenDocGroup(openDocGroup === group.id ? null : group.id)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-black/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon name={group.icon} size={18} className="text-primary shrink-0" fallback="FileText" />
                        <span className="font-semibold text-sm">{group.title}</span>
                        <span className="text-xs text-muted-foreground">({group.docs.length} документа)</span>
                      </div>
                      <Icon name={openDocGroup === group.id ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" fallback="Circle" />
                    </button>
                    {openDocGroup === group.id && (
                      <div className="border-t border-current/10 divide-y divide-current/10 bg-white/70">
                        {group.docs.map((doc, di) => (
                          <a key={di} href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-start gap-3 px-5 py-4 hover:bg-primary/5 transition-colors group">
                            <Icon name="FileText" size={14} className="text-muted-foreground mt-0.5 shrink-0" fallback="Circle" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-sm group-hover:text-primary transition-colors">{doc.title}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{doc.tag}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
                            </div>
                            <Icon name="ExternalLink" size={12} className="text-muted-foreground shrink-0 mt-1 group-hover:text-primary" fallback="Circle" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── СПРАВОЧНИКИ ── */}
            {infoTab === "Справочники" && (
              <div className="space-y-4">
                {editTemplate ? (
                  <TemplateEditor template={editTemplate} onBack={() => setEditTemplate(null)} />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Готовые шаблоны документов — заполняйте поля прямо на сайте</p>
                      <button onClick={() => setAddingTemplate(!addingTemplate)}
                        className="flex items-center gap-1.5 text-xs bg-primary text-white rounded-lg px-3 py-2 hover:bg-primary/90 transition-colors">
                        <Icon name="Plus" size={13} fallback="Plus" /> Добавить шаблон
                      </button>
                    </div>

                    {addingTemplate && (
                      <div className="bg-white border-2 border-primary/30 rounded-xl p-5 space-y-3">
                        <h3 className="font-medium text-sm">Новый шаблон</h3>
                        <input value={newTplTitle} onChange={e => setNewTplTitle(e.target.value)}
                          placeholder="Название документа" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                        <textarea value={newTplContent} onChange={e => setNewTplContent(e.target.value)}
                          placeholder="Содержание шаблона..." rows={6}
                          className="w-full border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary resize-none" />
                        <div className="flex gap-2">
                          <button onClick={addUserTemplate} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">Сохранить</button>
                          <button onClick={() => setAddingTemplate(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Отмена</button>
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      {[...TEMPLATES_DATA, ...userTemplates].map(tpl => (
                        <div key={tpl.id} className="bg-white border border-border rounded-xl p-5 flex flex-col">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tpl.category}</span>
                            {tpl.fields?.length > 0 && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <Icon name="PenLine" size={11} fallback="Circle" /> {tpl.fields.length} полей
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-sm mb-2 flex-1">{tpl.title}</h3>
                          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{tpl.description}</p>
                          <button onClick={() => setEditTemplate(tpl)}
                            className="w-full py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-1.5">
                            <Icon name="PenLine" size={13} fallback="Circle" /> Заполнить и скачать
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── МОИ СОУТ ── */}
            {infoTab === "Мои СОУТ" && (
              <div className="space-y-5">
                {editTemplate ? (
                  <TemplateEditor template={editTemplate} onBack={() => setEditTemplate(null)} />
                ) : (
                  <>
                    {/* Документы от работодателя — только для сотрудников */}
                    {user?.role === "employee" && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-2 flex items-center gap-1.5">
                          <Icon name="Building2" size={13} fallback="Circle" /> От работодателя
                        </p>
                        <CompanyDocsList docType="sout" />
                      </div>
                    )}

                    {/* Шаблоны для заполнения */}
                    <div>
                      {user?.role === "employee" && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Шаблоны для заполнения</p>
                      )}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 mb-3">
                        <Icon name="Info" size={16} className="text-blue-600 shrink-0 mt-0.5" fallback="Circle" />
                        <p className="text-sm text-blue-800">СОУТ проводится раз в 5 лет. Заполните карту по своему рабочему месту и скачайте готовый документ.</p>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        {SOUT_TEMPLATES.map(tpl => (
                          <div key={tpl.id} className="bg-white border border-border rounded-xl p-5 flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                <Icon name="ClipboardList" size={16} className="text-green-700" fallback="Circle" />
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">СОУТ</span>
                              <span className="text-xs text-green-600 ml-auto">{tpl.fields.length} полей</span>
                            </div>
                            <h3 className="font-semibold text-sm mb-2 flex-1">{tpl.title}</h3>
                            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{tpl.description}</p>
                            <button onClick={() => setEditTemplate(tpl)}
                              className="w-full py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-1.5">
                              <Icon name="PenLine" size={13} fallback="Circle" /> Заполнить карту СОУТ
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ПРОФРИСКИ ── */}
            {infoTab === "ПрофРиски" && (
              <div className="space-y-5">
                {editTemplate ? (
                  <TemplateEditor template={editTemplate} onBack={() => setEditTemplate(null)} />
                ) : (
                  <>
                    {/* Документы от работодателя — только для сотрудников */}
                    {user?.role === "employee" && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5">
                          <Icon name="Building2" size={13} fallback="Circle" /> От работодателя
                        </p>
                        <CompanyDocsList docType="profrisk" />
                      </div>
                    )}

                    {/* Шаблоны */}
                    <div>
                      {user?.role === "employee" && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Шаблоны для заполнения</p>
                      )}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-3">
                        <Icon name="AlertTriangle" size={16} className="text-amber-600 shrink-0 mt-0.5" fallback="Circle" />
                        <p className="text-sm text-amber-800">Оценка профессиональных рисков обязательна (ст. 214 ТК РФ). Заполните карту и скачайте готовый документ.</p>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        {PROFRISK_TEMPLATES.map(tpl => (
                          <div key={tpl.id} className="bg-white border border-border rounded-xl p-5 flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Icon name="AlertOctagon" size={16} className="text-amber-700" fallback="Circle" />
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">ПрофРиск</span>
                              <span className="text-xs text-amber-600 ml-auto">{tpl.fields.length} полей</span>
                            </div>
                            <h3 className="font-semibold text-sm mb-2 flex-1">{tpl.title}</h3>
                            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{tpl.description}</p>
                            <button onClick={() => setEditTemplate(tpl)}
                              className="w-full py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium flex items-center justify-center gap-1.5">
                              <Icon name="PenLine" size={13} fallback="Circle" /> Заполнить карту рисков
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {active === "tests" && testMode === "list" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Тестирование</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Программы обучения по охране труда — вопросы Минтруда РФ</p>
            </div>

            <div className="grid gap-3">
              {TESTS_DATA.map((t) => {
                const score = completedTests[t.id];
                const passed = score !== undefined && score >= t.passingScore;
                const failed = score !== undefined && score < t.passingScore;
                return (
                  <div key={t.id} className="bg-white border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:shadow-md">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {score === undefined && <StatusBadge status="pending" />}
                        {passed && <StatusBadge status="passed" />}
                        {failed && <StatusBadge status="failed" />}
                        {score !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            Результат: <strong className={passed ? "text-green-600" : "text-red-600"}>{score}%</strong>
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-sm mb-1">{t.title}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Icon name="HelpCircle" size={12} fallback="Circle" />{t.questions.length} вопросов</span>
                        <span className="flex items-center gap-1"><Icon name="Clock" size={12} fallback="Circle" />{t.time} мин</span>
                        <span className="flex items-center gap-1"><Icon name="Target" size={12} fallback="Circle" />Порог: {t.passingScore}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => startTest(t)}
                      className={`px-5 py-2.5 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                        passed
                          ? "bg-muted text-foreground hover:bg-muted/80"
                          : failed
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      {passed ? "Пройти повторно" : failed ? "Пересдать" : "Начать тест"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Icon name="Info" size={16} className="text-blue-600 mt-0.5 shrink-0" fallback="Circle" />
              <p className="text-sm text-blue-800">Для допуска к работе необходимо пройти все обязательные тесты с результатом не менее <strong>80%</strong>. Тесты можно пересдавать неограниченное число раз. В конце каждого теста отображается разбор ошибок.</p>
            </div>
          </div>
        )}

        {active === "tests" && testMode === "running" && activeTest && (
          <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={exitTest} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="ArrowLeft" size={15} fallback="Circle" />
                Выйти из теста
              </button>
              <span className="text-xs font-mono text-muted-foreground">
                {currentQ + 1} / {activeTest.questions.length}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-sm font-medium text-muted-foreground">{activeTest.title}</h2>
                <span className="text-xs text-muted-foreground">{Math.round(((currentQ + 1) / activeTest.questions.length) * 100)}%</span>
              </div>
              <Progress value={((currentQ + 1) / activeTest.questions.length) * 100} className="h-1.5" />
            </div>

            <div className="bg-white border border-border rounded-xl p-6">
              <div className="flex items-start gap-3 mb-6">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {currentQ + 1}
                </span>
                <p className="text-base font-medium leading-relaxed">{activeTest.questions[currentQ].text}</p>
              </div>

              <div className="space-y-2.5">
                {activeTest.questions[currentQ].options.map((opt, oi) => {
                  const selected = answers[currentQ] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(currentQ, oi)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all duration-150 ${
                        selected
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <span className={`inline-flex w-5 h-5 rounded-full border-2 mr-3 items-center justify-center text-xs font-bold shrink-0 ${
                        selected ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                      }`}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                disabled={currentQ === 0}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Назад
              </button>

              <div className="flex gap-1.5">
                {activeTest.questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                      i === currentQ
                        ? "bg-primary text-white"
                        : answers[i] !== undefined
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {currentQ < activeTest.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQ(q => q + 1)}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  Далее →
                </button>
              ) : (
                <button
                  onClick={finishTest}
                  disabled={Object.keys(answers).length < activeTest.questions.length}
                  className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Завершить тест
                </button>
              )}
            </div>

            {currentQ === activeTest.questions.length - 1 && Object.keys(answers).length < activeTest.questions.length && (
              <p className="text-xs text-center text-amber-600">
                Осталось ответить на {activeTest.questions.length - Object.keys(answers).length} вопрос(а)
              </p>
            )}
          </div>
        )}

        {active === "tests" && testMode === "results" && activeTest && (() => {
          const correct = activeTest.questions.filter((q, i) => answers[i] === q.correct).length;
          const score = Math.round((correct / activeTest.questions.length) * 100);
          const passed = score >= activeTest.passingScore;
          return (
            <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
              <button onClick={exitTest} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="ArrowLeft" size={15} fallback="Circle" />
                К списку тестов
              </button>

              <div className={`rounded-xl border-2 p-6 text-center ${passed ? "border-green-300 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold ${passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {score}%
                </div>
                <h2 className={`text-xl font-semibold mb-1 ${passed ? "text-green-800" : "text-red-700"}`}>
                  {passed ? "Тест пройден!" : "Тест не пройден"}
                </h2>
                <p className={`text-sm mb-3 ${passed ? "text-green-700" : "text-red-600"}`}>
                  {activeTest.title}
                </p>
                <div className="flex justify-center gap-6 text-sm">
                  <div>
                    <span className="font-bold text-green-700">{correct}</span>
                    <span className="text-muted-foreground ml-1">правильных</span>
                  </div>
                  <div>
                    <span className="font-bold text-red-600">{activeTest.questions.length - correct}</span>
                    <span className="text-muted-foreground ml-1">ошибок</span>
                  </div>
                  <div>
                    <span className="font-bold">{activeTest.questions.length}</span>
                    <span className="text-muted-foreground ml-1">всего</span>
                  </div>
                </div>
                {!passed && (
                  <p className="text-xs text-red-600 mt-3">Минимальный балл для прохождения: {activeTest.passingScore}%</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Icon name="BookOpen" size={15} className="text-primary" fallback="Circle" />
                  Разбор ответов
                </h3>
                <div className="space-y-4">
                  {activeTest.questions.map((q, i) => {
                    const userAns = answers[i];
                    const isCorrect = userAns === q.correct;
                    return (
                      <div key={i} className={`bg-white rounded-lg border-2 p-4 ${isCorrect ? "border-green-200" : "border-red-200"}`}>
                        <div className="flex items-start gap-2.5 mb-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCorrect ? "bg-green-100" : "bg-red-100"}`}>
                            <Icon name={isCorrect ? "Check" : "X"} size={11} className={isCorrect ? "text-green-600" : "text-red-600"} fallback="Circle" />
                          </div>
                          <p className="text-sm font-medium leading-snug">{q.text}</p>
                        </div>

                        <div className="space-y-1.5 mb-3">
                          {q.options.map((opt, oi) => {
                            const isUserChoice = userAns === oi;
                            const isRight = oi === q.correct;
                            return (
                              <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
                                isRight ? "bg-green-50 text-green-800 font-medium" :
                                isUserChoice && !isRight ? "bg-red-50 text-red-700 line-through" :
                                "text-muted-foreground"
                              }`}>
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                                  isRight ? "border-green-500 bg-green-500 text-white" :
                                  isUserChoice ? "border-red-400 bg-red-400 text-white" :
                                  "border-muted-foreground/30"
                                }`}>
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                {opt}
                                {isRight && <Icon name="Check" size={12} className="text-green-600 ml-auto shrink-0" fallback="Check" />}
                              </div>
                            );
                          })}
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                          <p className="text-xs text-blue-800 leading-relaxed">
                            <span className="font-semibold">Пояснение: </span>
                            {q.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => startTest(activeTest)} className="flex-1 py-2.5 text-sm rounded-md border border-border hover:bg-muted transition-colors font-medium">
                  Пройти повторно
                </button>
                <button onClick={exitTest} className="flex-1 py-2.5 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
                  К списку тестов
                </button>
              </div>
            </div>
          );
        })()}

        {active === "briefings" && !activeBriefingId && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Инструктажи</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Полные программы с текстом, видео и интерактивными заданиями</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {BRIEFINGS_DATA.map((b) => {
                const isDone = completedBriefings.has(b.id);
                const isDue = b.id === "repeat" && !isDone;
                return (
                  <div key={b.id} className={`bg-white border rounded-xl p-5 transition-all duration-200 hover:shadow-md flex flex-col ${isDue ? "border-amber-300" : "border-border"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isDone
                          ? <StatusBadge status="done" />
                          : isDue
                          ? <StatusBadge status="due" />
                          : <StatusBadge status="pending" />
                        }
                        {b.required && (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Обязательный</span>
                        )}
                        {b.variants && (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">2 варианта</span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap ml-2">
                        <Icon name="Clock" size={12} fallback="Circle" />{b.duration} мин
                      </span>
                    </div>
                    <h3 className="font-semibold text-base mb-1.5">{b.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{b.subtitle}</p>

                    <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                      {(b.blocks ?? b.variants?.[0]?.blocks ?? []).filter(bl => bl.type === "video").length > 0 && (
                        <span className="flex items-center gap-1 bg-muted rounded-full px-2 py-0.5">
                          <Icon name="Play" size={11} fallback="Circle" />
                          {(b.blocks ?? b.variants?.[0]?.blocks ?? []).filter(bl => bl.type === "video").length} видео
                        </span>
                      )}
                      {(b.blocks ?? b.variants?.[0]?.blocks ?? []).filter(bl => bl.type.startsWith("task")).length > 0 && (
                        <span className="flex items-center gap-1 bg-muted rounded-full px-2 py-0.5">
                          <Icon name="Zap" size={11} fallback="Circle" />
                          {(b.blocks ?? b.variants?.[0]?.blocks ?? []).filter(bl => bl.type.startsWith("task")).length} заданий
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setActiveBriefingId(b.id)}
                      className={`w-full py-2.5 text-sm rounded-lg font-medium transition-colors ${
                        isDone
                          ? "bg-muted text-foreground hover:bg-muted/80"
                          : isDue
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      {isDone ? "Пройти повторно" : isDue ? "Пройти (требуется)" : "Начать инструктаж"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {active === "briefings" && activeBriefingId && (() => {
          const briefing = BRIEFINGS_DATA.find(b => b.id === activeBriefingId);
          if (!briefing) return null;
          return (
            <BriefingPlayer
              briefing={briefing}
              onExit={() => setActiveBriefingId(null)}
              onComplete={(id) => {
                completeBriefing(id);
                setActiveBriefingId(null);
              }}
            />
          );
        })()}

        {active === "cabinet" && (
          user ? (
            <CabinetPanel onStartTest={(testId) => {
              const t = TESTS_DATA.find(td => td.id === testId);
              if (t) { startTest(t); navigate("tests"); }
            }} />
          ) : (
            <div className="animate-fade-in text-center py-24 space-y-4">
              <Icon name="UserCircle" size={48} className="mx-auto text-muted-foreground/30" fallback="Circle" />
              <p className="font-semibold text-lg">Войдите в аккаунт</p>
              <p className="text-sm text-muted-foreground">Для доступа к личному кабинету необходима авторизация</p>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={() => setAuthModal("login")} className="px-5 py-2.5 rounded-xl border border-primary text-primary hover:bg-primary/5 font-medium text-sm">Войти</button>
                <button onClick={() => setAuthModal("register")} className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 font-medium text-sm">Зарегистрироваться</button>
              </div>
            </div>
          )
        )}

        {active === "employer" && (
          user?.role === "employer" ? (
            <EmployerSection />
          ) : (
            <div className="animate-fade-in text-center py-24">
              <Icon name="ShieldOff" size={48} className="mx-auto text-muted-foreground/30 mb-4" fallback="Circle" />
              <p className="font-semibold">Доступ только для работодателей</p>
            </div>
          )
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
          !user ? (
            /* Незарегистрированным — запрет */
            <div className="animate-fade-in text-center py-24 space-y-4">
              <Icon name="Lock" size={48} className="mx-auto text-muted-foreground/30" fallback="Circle" />
              <p className="font-semibold text-lg">Раздел доступен только зарегистрированным</p>
              <p className="text-sm text-muted-foreground">Войдите или создайте аккаунт, чтобы увидеть контакты службы охраны труда вашей компании</p>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={() => setAuthModal("login")} className="px-5 py-2.5 rounded-xl border border-primary text-primary hover:bg-primary/5 font-medium text-sm">Войти</button>
                <button onClick={() => setAuthModal("register")} className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 font-medium text-sm">Зарегистрироваться</button>
              </div>
            </div>
          ) : !user.company_id ? (
            /* Пользователь без компании */
            <div className="animate-fade-in text-center py-24">
              <Icon name="Building2" size={48} className="mx-auto text-muted-foreground/30 mb-4" fallback="Circle" />
              <p className="font-semibold">Компания не привязана</p>
              <p className="text-sm text-muted-foreground mt-1">Обратитесь к работодателю для добавления в компанию</p>
            </div>
          ) : (
            <div className="animate-fade-in space-y-6">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
                <h1 className="text-2xl font-semibold">Контакты</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Служба охраны труда · {user.company_name}
                  {user.role === "employer" && (
                    <span className="ml-2 text-xs text-primary">(вы можете редактировать)</span>
                  )}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <CompanyContacts
                  companyId={user.company_id}
                  companyName={user.company_name || ""}
                />

                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <Icon name="AlertTriangle" size={16} className="text-amber-600 mt-0.5 shrink-0" fallback="Circle" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Экстренная ситуация?</p>
                      <p className="text-xs text-amber-700 mt-0.5">Вызов экстренных служб: <strong>112</strong></p>
                      <p className="text-xs text-amber-700">Скорая: <strong>103</strong> · Пожарная: <strong>101</strong></p>
                    </div>
                  </div>

                  <div className="bg-white border border-border rounded-xl p-5">
                    <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Icon name="MessageSquare" size={15} className="text-primary" fallback="Circle" />
                      Написать специалисту по ОТ
                    </h2>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Тема</label>
                        <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary">
                          <option>Вопрос по инструктажу</option>
                          <option>Вопрос по тестированию</option>
                          <option>Сообщить об опасности</option>
                          <option>Другое</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Сообщение</label>
                        <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none h-24 focus:outline-none focus:border-primary" placeholder="Опишите ваш вопрос..." />
                      </div>
                      <button className="w-full bg-primary text-white py-2 text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors">
                        Отправить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* AuthModal */}
      {authModal && (
        <AuthModal
          initialMode={authModal}
          onClose={() => setAuthModal(false)}
        />
      )}

      {/* Overlay для закрытия avatar-меню */}
      {avatarMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setAvatarMenu(false)} />
      )}

      <footer className="border-t border-border bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img
              src="https://cdn.poehali.dev/projects/cd71ce52-bb4a-42e1-b3e8-36fe92953b9e/bucket/f6918456-1a71-48db-8e71-dd06833a8284.png"
              alt="Логотип"
              className="w-6 h-6 object-contain rounded-full"
            />
            <span>ОхранаТруда-Безопасность · Платформа обучения</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 · Все права защищены</p>
        </div>
      </footer>
    </div>
  );
}
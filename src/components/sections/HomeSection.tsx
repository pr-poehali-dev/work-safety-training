import { Progress } from "@/components/ui/progress";
import Icon from "@/components/ui/icon";
import { TESTS_DATA, type TestData } from "@/data/tests";
import { BRIEFINGS_DATA } from "@/data/briefings";
import { useAuth } from "@/contexts/AuthContext";

const NEWS_URL = "https://functions.poehali.dev/c3136b62-f96f-4c75-a5cf-4c4a43cad9db";

interface NewsItem {
  tag: string;
  title: string;
  description: string;
  url: string;
  date: string;
}

interface HomeSectionProps {
  completedTests: Record<string, number>;
  completedBriefings: Set<string>;
  checklistState: { title: string; items: { text: string; done: boolean }[] }[];
  news: NewsItem[];
  newsLoading: boolean;
  newsFilter: string;
  setNewsFilter: (v: string) => void;
  navigate: (id: string, opts?: { briefingId?: string }) => void;
  startTest: (test: TestData) => void;
  setAuthModal: (v: "login" | "register") => void;
}

export default function HomeSection({
  completedTests,
  completedBriefings,
  checklistState,
  news,
  newsLoading,
  newsFilter,
  setNewsFilter,
  navigate,
  startTest,
  setAuthModal,
}: HomeSectionProps) {
  const { user, assignedBriefings } = useAuth();

  const newsFilters = ["Все", "Новость", "Надзор", "Мероприятие"];

  const doneTests = Object.keys(completedTests).length;
  const totalTests = TESTS_DATA.length;
  const doneBriefings = completedBriefings.size;
  const totalBriefings = BRIEFINGS_DATA.length;
  const doneChecklists = checklistState.reduce((s, c) => s + c.items.filter(i => i.done).length, 0);
  const totalChecklists = checklistState.reduce((s, c) => s + c.items.length, 0);
  const nextDue = assignedBriefings
    .filter(ab => !ab.completed_at && ab.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];
  const daysLeft = nextDue
    ? Math.max(0, Math.ceil((new Date(nextDue.due_date!).getTime() - Date.now()) / 86400000))
    : null;

  const cards = [
    { label: "Пройдено тестов", value: doneTests, sub: `из ${totalTests}`, icon: "ClipboardCheck", section: "tests" as const },
    { label: "Инструктажей", value: doneBriefings, sub: `из ${totalBriefings}`, icon: "BookOpen", section: "briefings" as const },
    { label: "Чек-листов", value: doneChecklists, sub: `из ${totalChecklists} пунктов`, icon: "ListChecks", section: "checklists" as const },
    {
      label: daysLeft !== null ? "Дней до инструктажа" : "До инструктажа",
      value: daysLeft !== null ? daysLeft : "—",
      sub: daysLeft !== null ? nextDue!.briefing_title : "Нет назначенных",
      icon: "Bell",
      section: "briefings" as const,
    },
  ];

  return (
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
        {cards.map((s, i) => (
          <button
            key={i}
            onClick={() => navigate(s.section)}
            className="bg-white border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Icon name={s.icon as "Bell"} size={15} className="text-primary" fallback="Circle" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-foreground">{s.value}</div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {s.sub && <span className="font-medium">{s.sub} · </span>}
              {s.label}
            </p>
          </button>
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
  );
}

export { NEWS_URL };
export type { NewsItem };

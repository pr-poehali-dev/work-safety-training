import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import Icon from "@/components/ui/icon";
import { TESTS_DATA, type TestData } from "@/data/tests";
import { BRIEFINGS_DATA, type BriefingData } from "@/data/briefings";
import BriefingPlayer from "@/components/BriefingPlayer";
import CabinetPanel from "@/components/CabinetPanel";
import EmployerPanel from "@/components/EmployerPanel";
import DocumentsUploader from "@/components/DocumentsUploader";
import CompanyContacts from "@/components/CompanyContacts";
import CompanyChat from "@/components/CompanyChat";
import CustomTestBuilder from "@/components/CustomTestBuilder";
import BriefingEditor from "@/components/BriefingEditor";
import { useAuth } from "@/contexts/AuthContext";

type Section = "home" | "info" | "tests" | "briefings" | "cabinet" | "employer" | "checklists" | "contacts" | "messages";
type TestMode = "list" | "running" | "results";

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

function EmployerSectionStateful() {
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

interface MainSectionsProps {
  active: Section;
  testMode: TestMode;
  activeTest: TestData | null;
  currentQ: number;
  setCurrentQ: (fn: (q: number) => number) => void;
  answers: Record<number, number>;
  completedTests: Record<string, number>;
  completedBriefings: Set<string>;
  checklistState: { title: string; items: { text: string; done: boolean }[] }[];
  checklistNewText: string[];
  setChecklistNewText: (fn: (prev: string[]) => string[]) => void;
  testsTab: "standard" | "custom";
  setTestsTab: (v: "standard" | "custom") => void;
  briefingsTab: "standard" | "custom";
  setBriefingsTab: (v: "standard" | "custom") => void;
  activeBriefingId: string | null;
  customBriefingData: BriefingData | null;
  cabinetInitialTab: "profile" | "notifications" | "tests";
  chatReceiverId: number | undefined;
  chatSubject: string;
  setChatUnread: (v: number) => void;
  startTest: (test: TestData) => void;
  startCustomTest: (customTestId: number, title: string) => void;
  selectAnswer: (qIndex: number, optIndex: number) => void;
  finishTest: () => void;
  exitTest: () => void;
  startCustomBriefing: (id: number) => void;
  markBriefingDone: (id: string) => void;
  completeBriefing: (briefing_id: number) => void;
  setActiveBriefingId: (v: string | null) => void;
  setCustomBriefingData: (v: BriefingData | null) => void;
  toggleItem: (ci: number, ii: number) => void;
  addCheckItem: (ci: number, text: string) => void;
  removeCheckItem: (ci: number, ii: number) => void;
  resetChecklists: () => void;
  navigate: (id: string, opts?: Record<string, unknown>) => void;
  setAuthModal: (v: "login" | "register") => void;
  setChatReceiverId: (v: number | undefined) => void;
  setChatSubject: (v: string) => void;
}

export default function MainSections({
  active,
  testMode,
  activeTest,
  currentQ,
  setCurrentQ,
  answers,
  completedTests,
  completedBriefings,
  checklistState,
  checklistNewText,
  setChecklistNewText,
  testsTab,
  setTestsTab,
  briefingsTab,
  setBriefingsTab,
  activeBriefingId,
  customBriefingData,
  cabinetInitialTab,
  chatReceiverId,
  chatSubject,
  setChatUnread,
  startTest,
  startCustomTest,
  selectAnswer,
  finishTest,
  exitTest,
  startCustomBriefing,
  markBriefingDone,
  completeBriefing,
  setActiveBriefingId,
  setCustomBriefingData,
  toggleItem,
  addCheckItem,
  removeCheckItem,
  resetChecklists,
  navigate,
  setAuthModal,
  setChatReceiverId,
  setChatSubject,
}: MainSectionsProps) {
  const { user, assignedTests, assignedBriefings } = useAuth();

  return (
    <>
      {/* ── ТЕСТЫ: СПИСОК ── */}
      {active === "tests" && testMode === "list" && (
        <div className="animate-fade-in space-y-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
            <h1 className="text-2xl font-semibold">Тестирование</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.role === "employer" ? "Стандартные тесты и управление собственными" : "Программы обучения по охране труда"}
            </p>
          </div>

          {user?.role === "employer" && (
            <div className="flex gap-1 border-b border-border">
              {([
                { id: "standard", label: "Стандартные тесты", icon: "BookOpen" },
                { id: "custom", label: "Мои тесты", icon: "ClipboardList" },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setTestsTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                    testsTab === tab.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon name={tab.icon} size={14} fallback="Circle" />
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {user?.role === "employer" && testsTab === "custom" && (
            <CustomTestBuilder onBack={() => setTestsTab("standard")} />
          )}

          {(user?.role !== "employer" || testsTab === "standard") && (
            <>
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
                          passed ? "bg-muted text-foreground hover:bg-muted/80"
                          : failed ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-primary text-white hover:bg-primary/90"
                        }`}
                      >
                        {passed ? "Пройти повторно" : failed ? "Пересдать" : "Начать тест"}
                      </button>
                    </div>
                  );
                })}

                {user?.role === "employee" && assignedTests.filter(at => at.test_id.startsWith("custom_")).map(at => {
                  const customId = Number(at.test_id.replace("custom_", ""));
                  const score = at.score ?? completedTests[at.test_id];
                  const passed = score !== undefined && score !== null && score >= 80;
                  const failed = score !== undefined && score !== null && !passed;
                  return (
                    <div key={at.id} className="bg-white border border-primary/20 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:shadow-md">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">От работодателя</span>
                          {score === undefined || score === null ? <StatusBadge status="pending" /> : passed ? <StatusBadge status="passed" /> : <StatusBadge status="failed" />}
                          {score !== undefined && score !== null && (
                            <span className="text-xs text-muted-foreground">Результат: <strong className={passed ? "text-green-600" : "text-red-600"}>{score}%</strong></span>
                          )}
                        </div>
                        <h3 className="font-medium text-sm mb-1">{at.test_title}</h3>
                        {at.due_date && <p className="text-xs text-amber-600">Срок: {at.due_date}</p>}
                      </div>
                      <button
                        onClick={() => startCustomTest(customId, at.test_title)}
                        className={`px-5 py-2.5 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                          passed ? "bg-muted text-foreground hover:bg-muted/80"
                          : failed ? "bg-red-500 text-white hover:bg-red-600"
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
                <p className="text-sm text-blue-800">Для допуска к работе необходимо пройти все обязательные тесты с результатом не менее <strong>80%</strong>. Тесты можно пересдавать неограниченное число раз.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ТЕСТЫ: ПРОХОЖДЕНИЕ ── */}
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
                  onClick={() => setCurrentQ(() => i)}
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

      {/* ── ТЕСТЫ: РЕЗУЛЬТАТЫ ── */}
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

      {/* ── ИНСТРУКТАЖИ: СПИСОК ── */}
      {active === "briefings" && !activeBriefingId && (
        <div className="animate-fade-in space-y-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
            <h1 className="text-2xl font-semibold">Инструктажи</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.role === "employer" ? "Стандартные инструктажи и управление собственными" : "Полные программы с текстом, видео и интерактивными заданиями"}
            </p>
          </div>

          {user?.role === "employer" && (
            <div className="flex gap-1 border-b border-border">
              {([
                { id: "standard", label: "Стандартные", icon: "BookOpen" },
                { id: "custom", label: "Мои инструктажи", icon: "Edit3" },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setBriefingsTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                    briefingsTab === tab.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon name={tab.icon} size={14} fallback="Circle" />
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {user?.role === "employer" && briefingsTab === "custom" && (
            <BriefingEditor
              onBack={() => setBriefingsTab("standard")}
              onPreview={(id) => startCustomBriefing(id)}
            />
          )}

          {(user?.role !== "employer" || briefingsTab === "standard") && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                {BRIEFINGS_DATA.map((b) => {
                  const isDone = completedBriefings.has(b.id);
                  const isDue = b.id === "repeat" && !isDone;
                  return (
                    <div key={b.id} className={`bg-white border rounded-xl p-5 transition-all duration-200 hover:shadow-md flex flex-col ${isDue ? "border-amber-300" : "border-border"}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isDone ? <StatusBadge status="done" /> : isDue ? <StatusBadge status="due" /> : <StatusBadge status="pending" />}
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
                          isDone ? "bg-muted text-foreground hover:bg-muted/80"
                          : isDue ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-primary text-white hover:bg-primary/90"
                        }`}
                      >
                        {isDone ? "Пройти повторно" : isDue ? "Пройти (требуется)" : "Начать инструктаж"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {user?.role === "employee" && assignedBriefings.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Icon name="Building2" size={15} className="text-primary" fallback="Circle" />
                    Назначены работодателем
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {assignedBriefings.map(ab => {
                      const isDone = !!ab.completed_at;
                      const isOverdue = !isDone && ab.due_date && new Date(ab.due_date) < new Date();
                      return (
                        <div key={ab.id} className={`bg-white border rounded-xl p-5 transition-all duration-200 hover:shadow-md flex flex-col ${isOverdue ? "border-red-300" : isDone ? "border-green-200" : "border-primary/30"}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isDone
                                ? <StatusBadge status="done" />
                                : isOverdue
                                ? <StatusBadge status="due" />
                                : <StatusBadge status="pending" />}
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">От работодателя</span>
                            </div>
                            {ab.due_date && (
                              <span className={`text-xs whitespace-nowrap ml-2 ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                до {ab.due_date.slice(0, 10)}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-base mb-1">{ab.briefing_title}</h3>
                          {ab.employer_fio && (
                            <p className="text-xs text-muted-foreground mb-3 flex-1">Назначил: {ab.employer_fio}</p>
                          )}
                          {isDone && (
                            <p className="text-xs text-green-700 mb-3 flex items-center gap-1">
                              <Icon name="CheckCircle" size={12} fallback="Check" />
                              Пройдено {ab.completed_at?.slice(0, 10)}
                            </p>
                          )}
                          <button
                            onClick={() => startCustomBriefing(ab.briefing_id)}
                            className={`w-full py-2.5 text-sm rounded-lg font-medium transition-colors ${
                              isDone ? "bg-muted text-foreground hover:bg-muted/80"
                              : isOverdue ? "bg-red-500 text-white hover:bg-red-600"
                              : "bg-primary text-white hover:bg-primary/90"
                            }`}
                          >
                            {isDone ? "Пройти повторно" : "Начать инструктаж"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ИНСТРУКТАЖИ: ПЛЕЕР ── */}
      {active === "briefings" && activeBriefingId && (() => {
        if (activeBriefingId.startsWith("custom_briefing_") && customBriefingData) {
          const customId = Number(activeBriefingId.replace("custom_briefing_", ""));
          return (
            <BriefingPlayer
              briefing={customBriefingData}
              onExit={() => { setActiveBriefingId(null); setCustomBriefingData(null); }}
              onComplete={() => {
                completeBriefing(customId);
                setActiveBriefingId(null);
                setCustomBriefingData(null);
              }}
            />
          );
        }
        const briefing = BRIEFINGS_DATA.find(b => b.id === activeBriefingId);
        if (!briefing) return null;
        return (
          <BriefingPlayer
            briefing={briefing}
            onExit={() => setActiveBriefingId(null)}
            onComplete={(id) => {
              markBriefingDone(id);
              setActiveBriefingId(null);
            }}
          />
        );
      })()}

      {/* ── КАБИНЕТ ── */}
      {active === "cabinet" && (
        user ? (
          <CabinetPanel
            onStartTest={(testId) => {
              const t = TESTS_DATA.find(td => td.id === testId);
              if (t) { startTest(t); navigate("tests"); }
            }}
            onLogout={() => navigate("home")}
            initialTab={cabinetInitialTab}
          />
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

      {/* ── РАБОТОДАТЕЛЬ ── */}
      {active === "employer" && (
        user?.role === "employer" ? (
          <EmployerSectionStateful />
        ) : (
          <div className="animate-fade-in text-center py-24">
            <Icon name="ShieldOff" size={48} className="mx-auto text-muted-foreground/30 mb-4" fallback="Circle" />
            <p className="font-semibold">Доступ только для работодателей</p>
          </div>
        )
      )}

      {/* ── ЧЕК-ЛИСТЫ ── */}
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
              const pct = cl.items.length > 0 ? Math.round((done / cl.items.length) * 100) : 0;
              return (
                <div key={ci} className="bg-white border border-border rounded-lg p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="font-semibold text-sm">{cl.title}</h2>
                    <span className={`text-xs font-medium ${pct === 100 ? "text-green-600" : "text-muted-foreground"}`}>{done}/{cl.items.length}</span>
                  </div>
                  <div className="mb-4">
                    <Progress value={pct} className="h-1" />
                  </div>
                  <div className="space-y-2">
                    {cl.items.map((item, ii) => (
                      <div key={ii} className="flex items-start gap-2 group">
                        <div
                          className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer ${
                            item.done ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                          }`}
                          onClick={() => toggleItem(ci, ii)}
                        >
                          {item.done && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                        </div>
                        <span
                          className={`text-sm leading-snug select-none flex-1 cursor-pointer ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                          onClick={() => toggleItem(ci, ii)}
                        >
                          {item.text}
                        </span>
                        {user && (
                          <button
                            onClick={() => removeCheckItem(ci, ii)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                            title="Удалить пункт"
                          >
                            <Icon name="X" size={13} fallback="X" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {user && (
                    <div className="mt-3 flex gap-1.5">
                      <input
                        value={checklistNewText[ci]}
                        onChange={e => setChecklistNewText(prev => prev.map((v, i) => i === ci ? e.target.value : v))}
                        onKeyDown={e => {
                          if (e.key === "Enter" && checklistNewText[ci].trim()) {
                            addCheckItem(ci, checklistNewText[ci]);
                            setChecklistNewText(prev => prev.map((v, i) => i === ci ? "" : v));
                          }
                        }}
                        placeholder="Добавить пункт..."
                        className="flex-1 text-xs border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:border-primary min-w-0"
                      />
                      <button
                        onClick={() => {
                          if (checklistNewText[ci].trim()) {
                            addCheckItem(ci, checklistNewText[ci]);
                            setChecklistNewText(prev => prev.map((v, i) => i === ci ? "" : v));
                          }
                        }}
                        className="shrink-0 px-2 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Icon name="Plus" size={13} fallback="Plus" />
                      </button>
                    </div>
                  )}

                  {pct === 100 && cl.items.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">
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

      {/* ── КОНТАКТЫ ── */}
      {active === "contacts" && (
        !user ? (
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
                  <p className="text-xs text-muted-foreground mb-4">
                    Отправьте сообщение напрямую специалисту по охране труда вашей компании. Ответ придёт в переписку.
                  </p>
                  {[
                    "Вопрос по инструктажу",
                    "Вопрос по тестированию",
                    "Сообщить об опасности",
                    "Другое",
                  ].map(topic => (
                    <button
                      key={topic}
                      onClick={() => {
                        setChatReceiverId(undefined);
                        setChatSubject(topic);
                        navigate("messages");
                      }}
                      className="w-full text-left px-3 py-2.5 mb-2 text-sm rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center gap-2"
                    >
                      <Icon name="ChevronRight" size={13} className="text-muted-foreground" fallback="Circle" />
                      {topic}
                    </button>
                  ))}
                  <button
                    onClick={() => { setChatReceiverId(undefined); setChatSubject(""); navigate("messages"); }}
                    className="w-full mt-1 bg-primary text-white py-2 text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="MessageSquare" size={14} fallback="Circle" />
                    Открыть переписку
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── ПЕРЕПИСКА ── */}
      {active === "messages" && (
        !user ? (
          <div className="animate-fade-in text-center py-24 space-y-4">
            <Icon name="Lock" size={48} className="mx-auto text-muted-foreground/30" fallback="Circle" />
            <p className="font-semibold text-lg">Раздел доступен только зарегистрированным</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setAuthModal("login")} className="px-5 py-2.5 rounded-xl border border-primary text-primary font-medium text-sm">Войти</button>
              <button onClick={() => setAuthModal("register")} className="px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm">Зарегистрироваться</button>
            </div>
          </div>
        ) : !user.company_id ? (
          <div className="animate-fade-in text-center py-24">
            <Icon name="Building2" size={48} className="mx-auto text-muted-foreground/30 mb-4" fallback="Circle" />
            <p className="font-semibold">Компания не привязана</p>
          </div>
        ) : (
          <div className="animate-fade-in space-y-5">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Переписка</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{user.company_name}</p>
            </div>
            <CompanyChat
              initialReceiverId={chatReceiverId}
              initialSubject={chatSubject}
              onUnreadChange={setChatUnread}
            />
          </div>
        )
      )}
    </>
  );
}
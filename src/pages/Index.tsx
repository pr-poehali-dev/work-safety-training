import { useState, useEffect, useRef } from "react";
import { TESTS_DATA, type TestData } from "@/data/tests";
import { BRIEFINGS_DATA, type BriefingData } from "@/data/briefings";
import { useAuth } from "@/contexts/AuthContext";
import { uGet, uSet } from "@/utils/userStorage";
import AppLayout from "@/components/sections/AppLayout";
import HomeSection, { NEWS_URL, type NewsItem } from "@/components/sections/HomeSection";
import InfoSection, { INFO_TABS, type InfoTab } from "@/components/sections/InfoSection";
import MainSections from "@/components/sections/MainSections";
import { type Template } from "@/data/infoData";
import { type SavedCard } from "@/components/TemplateEditor";

type Section = "home" | "info" | "tests" | "briefings" | "cabinet" | "employer" | "checklists" | "contacts" | "messages";
type TestMode = "list" | "running" | "results";

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

export default function Index() {
  const { user, loading: authLoading, completeTest, completeBriefing } = useAuth();

  const [authModal, setAuthModal] = useState<false | "login" | "register" | "forgot" | "reset">(false);
  const [resetToken, setResetToken] = useState("");
  const [avatarMenu, setAvatarMenu] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset_token");
    if (token) { setResetToken(token); setAuthModal("reset"); }
  }, []);

  useEffect(() => {
    if (!avatarMenu) return;
    const handler = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [avatarMenu]);

  const [active, setActive] = useState<Section>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cabinetInitialTab, setCabinetInitialTab] = useState<"profile" | "notifications" | "tests">("profile");
  const [checklistState, setChecklistState] = useState(CHECKLISTS_DATA);
  const [checklistNewText, setChecklistNewText] = useState<string[]>(CHECKLISTS_DATA.map(() => ""));
  const [notification, setNotification] = useState(true);
  const [chatReceiverId, setChatReceiverId] = useState<number | undefined>(undefined);
  const [chatSubject, setChatSubject] = useState<string>("");
  const [chatUnread, setChatUnread] = useState(0);

  // News
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

  const filteredNews = newsFilter === "Все" ? news : news.filter(n => n.tag === newsFilter);

  // Info section
  const [infoTab, setInfoTab] = useState<InfoTab>("Новости");
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [editSavedCard, setEditSavedCard] = useState<SavedCard | null>(null);
  const [viewCard, setViewCard] = useState<{ template: Template; values: Record<string, string> } | null>(null);
  const switchInfoTab = (tab: InfoTab) => { setInfoTab(tab); setEditTemplate(null); setEditSavedCard(null); setViewCard(null); setAddingTemplate(false); };
  const [openDocGroup, setOpenDocGroup] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplContent, setNewTplContent] = useState("");

  useEffect(() => {
    if (user?.id) { setUserTemplates(uGet(user.id, "userTemplates", [])); }
    else { setUserTemplates([]); }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) { uSet(user.id, "userTemplates", userTemplates); }
  }, [userTemplates, user?.id]);

  const addUserTemplate = () => {
    if (!newTplTitle.trim()) return;
    const newTpl = {
      id: `user_${Date.now()}`,
      title: newTplTitle.trim(),
      description: "Создан вами",
      category: "Мои шаблоны",
      content: "",
      fields: [] as import("@/data/infoData").TemplateField[],
    };
    setUserTemplates(prev => [...prev, newTpl]);
    setNewTplTitle("");
    setNewTplContent("");
    setAddingTemplate(false);
    setEditTemplate(newTpl);
  };

  // Briefings
  const [activeBriefingId, setActiveBriefingId] = useState<string | null>(null);
  const [completedBriefings, setCompletedBriefings] = useState<Set<string>>(new Set());
  const [briefingsTab, setBriefingsTab] = useState<"standard" | "custom">("standard");
  const [customBriefingData, setCustomBriefingData] = useState<BriefingData | null>(null);

  // Tests
  const [testMode, setTestMode] = useState<TestMode>("list");
  const [activeTest, setActiveTest] = useState<TestData | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [completedTests, setCompletedTests] = useState<Record<string, number>>({});
  const [testsTab, setTestsTab] = useState<"standard" | "custom">("standard");

  useEffect(() => {
    if (user?.id) {
      setCompletedBriefings(new Set(uGet<string[]>(user.id, "completedBriefings", [])));
      setCompletedTests(uGet<Record<string, number>>(user.id, "completedTests", {}));
      setChecklistState(uGet(user.id, "checklistState", CHECKLISTS_DATA));
    } else {
      setCompletedBriefings(new Set());
      setCompletedTests({});
      setChecklistState(CHECKLISTS_DATA);
    }
  }, [user?.id]);

  const markBriefingDone = (id: string) => {
    setCompletedBriefings(prev => {
      const s = new Set(prev);
      s.add(id);
      if (user?.id) uSet(user.id, "completedBriefings", [...s]);
      return s;
    });
  };

  const startTest = (test: TestData) => {
    setActiveTest(test);
    setCurrentQ(0);
    setAnswers({});
    setTestMode("running");
  };

  const startCustomTest = async (customTestId: number, title: string) => {
    try {
      const sid = document.cookie.match(/(?:^|;\s*)session_id=([^;]*)/)?.[1] || "";
      const EMPLOYER_URL_INLINE = "https://functions.poehali.dev/2db38725-d446-4c74-8d25-b78ef3437142";
      const res = await fetch(`${EMPLOYER_URL_INLINE}?action=custom_test_for_employee&id=${customTestId}`, {
        headers: { "X-Cookie": `session_id=${sid}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      const t = d.test;
      const testData: TestData = {
        id: `custom_${customTestId}`,
        title: t.title,
        description: t.description || "",
        time: t.time_limit,
        passingScore: t.passing_score,
        questions: t.questions,
      };
      startTest(testData);
    } catch { /* ignore */ }
  };

  const selectAnswer = (qIndex: number, optIndex: number) => {
    setAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
  };

  const finishTest = () => {
    if (!activeTest) return;
    const correct = activeTest.questions.filter((q, i) => answers[i] === q.correct).length;
    const score = Math.round((correct / activeTest.questions.length) * 100);
    setCompletedTests(prev => {
      const next = { ...prev, [activeTest.id]: score };
      if (user?.id) uSet(user.id, "completedTests", next);
      return next;
    });
    setTestMode("results");
    if (user) completeTest(activeTest.id, score);
  };

  const exitTest = () => {
    setTestMode("list");
    setActiveTest(null);
    setAnswers({});
    setCurrentQ(0);
  };

  const EMPLOYER_URL_BRIEFING = "https://functions.poehali.dev/2db38725-d446-4c74-8d25-b78ef3437142";

  const startCustomBriefing = async (id: number) => {
    try {
      const sid = document.cookie.match(/(?:^|;\s*)session_id=([^;]*)/)?.[1] || "";
      const res = await fetch(`${EMPLOYER_URL_BRIEFING}?action=briefing_for_employee&id=${id}`, {
        headers: { "X-Cookie": `session_id=${sid}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      const b = d.briefing;
      const briefingData: BriefingData = {
        id: `custom_briefing_${id}`,
        title: b.title,
        subtitle: b.subtitle || "",
        duration: b.duration,
        required: false,
        blocks: b.blocks,
      };
      setCustomBriefingData(briefingData);
      setActiveBriefingId(`custom_briefing_${id}`);
    } catch { /* ignore */ }
  };

  const saveChecklist = (next: typeof CHECKLISTS_DATA) => {
    if (user?.id) uSet(user.id, "checklistState", next);
  };

  const toggleItem = (ci: number, ii: number) => {
    setChecklistState(prev => {
      const next = prev.map((c, i) =>
        i === ci ? { ...c, items: c.items.map((item, j) => j === ii ? { ...item, done: !item.done } : item) } : c
      );
      saveChecklist(next);
      return next;
    });
  };

  const addCheckItem = (ci: number, text: string) => {
    if (!text.trim()) return;
    setChecklistState(prev => {
      const next = prev.map((c, i) =>
        i === ci ? { ...c, items: [...c.items, { text: text.trim(), done: false }] } : c
      );
      saveChecklist(next);
      return next;
    });
  };

  const removeCheckItem = (ci: number, ii: number) => {
    setChecklistState(prev => {
      const next = prev.map((c, i) =>
        i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c
      );
      saveChecklist(next);
      return next;
    });
  };

  const resetChecklists = () => {
    const next = CHECKLISTS_DATA.map(c => ({ ...c, items: c.items.map(i => ({ ...i, done: false })) }));
    setChecklistState(next);
    saveChecklist(next);
  };

  const navigate = (id: string, opts?: { briefingId?: string; infoTab?: InfoTab; cabinetTab?: "profile" | "notifications" | "tests" }) => {
    setActive(id as Section);
    setSidebarOpen(false);
    if (opts?.briefingId) setActiveBriefingId(opts.briefingId);
    if (opts?.infoTab) switchInfoTab(opts.infoTab);
    if (id === "cabinet") setCabinetInitialTab(opts?.cabinetTab ?? "profile");
  };

  return (
    <AppLayout
      active={active}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      notification={notification}
      setNotification={setNotification}
      avatarMenu={avatarMenu}
      setAvatarMenu={setAvatarMenu}
      avatarMenuRef={avatarMenuRef}
      chatUnread={chatUnread}
      authModal={authModal}
      setAuthModal={setAuthModal}
      resetToken={resetToken}
      setResetToken={setResetToken}
      navigate={navigate}
      setChatReceiverId={setChatReceiverId}
      setChatSubject={setChatSubject}
    >
      {active === "home" && (
        <HomeSection
          completedTests={completedTests}
          completedBriefings={completedBriefings}
          checklistState={checklistState}
          news={news}
          newsLoading={newsLoading}
          newsFilter={newsFilter}
          setNewsFilter={setNewsFilter}
          navigate={navigate}
          startTest={startTest}
          setAuthModal={setAuthModal as (v: "login" | "register") => void}
        />
      )}

      {active === "info" && (
        <InfoSection
          infoTab={infoTab}
          switchInfoTab={switchInfoTab}
          news={news}
          newsLoading={newsLoading}
          newsFilter={newsFilter}
          setNewsFilter={setNewsFilter}
          filteredNews={filteredNews}
          openDocGroup={openDocGroup}
          setOpenDocGroup={setOpenDocGroup}
          editTemplate={editTemplate}
          setEditTemplate={setEditTemplate}
          editSavedCard={editSavedCard}
          setEditSavedCard={setEditSavedCard}
          viewCard={viewCard}
          setViewCard={setViewCard}
          userTemplates={userTemplates}
          setUserTemplates={setUserTemplates}
          addingTemplate={addingTemplate}
          setAddingTemplate={setAddingTemplate}
          newTplTitle={newTplTitle}
          setNewTplTitle={setNewTplTitle}
          newTplContent={newTplContent}
          setNewTplContent={setNewTplContent}
          addUserTemplate={addUserTemplate}
        />
      )}

      <MainSections
        active={active}
        testMode={testMode}
        activeTest={activeTest}
        currentQ={currentQ}
        setCurrentQ={setCurrentQ}
        answers={answers}
        completedTests={completedTests}
        completedBriefings={completedBriefings}
        checklistState={checklistState}
        checklistNewText={checklistNewText}
        setChecklistNewText={setChecklistNewText}
        testsTab={testsTab}
        setTestsTab={setTestsTab}
        briefingsTab={briefingsTab}
        setBriefingsTab={setBriefingsTab}
        activeBriefingId={activeBriefingId}
        customBriefingData={customBriefingData}
        cabinetInitialTab={cabinetInitialTab}
        chatReceiverId={chatReceiverId}
        chatSubject={chatSubject}
        setChatUnread={setChatUnread}
        startTest={startTest}
        startCustomTest={startCustomTest}
        selectAnswer={selectAnswer}
        finishTest={finishTest}
        exitTest={exitTest}
        startCustomBriefing={startCustomBriefing}
        markBriefingDone={markBriefingDone}
        completeBriefing={completeBriefing}
        setActiveBriefingId={setActiveBriefingId}
        setCustomBriefingData={setCustomBriefingData}
        toggleItem={toggleItem}
        addCheckItem={addCheckItem}
        removeCheckItem={removeCheckItem}
        resetChecklists={resetChecklists}
        navigate={navigate}
        setAuthModal={setAuthModal as (v: "login" | "register") => void}
        setChatReceiverId={setChatReceiverId}
        setChatSubject={setChatSubject}
      />
    </AppLayout>
  );
}

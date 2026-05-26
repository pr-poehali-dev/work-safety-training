import { useState, useEffect, useRef, type ReactNode } from "react";
import Icon from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { TESTS_DATA, type TestData } from "@/data/tests";
import { BRIEFINGS_DATA, type BriefingData } from "@/data/briefings";
import BriefingPlayer from "@/components/BriefingPlayer";
import {
  DOCUMENTS_DATA,
  TEMPLATES_DATA,
  SOUT_TEMPLATES,
  PROFRISK_TEMPLATES,
  type Template,
} from "@/data/infoData";
import TemplateEditor, { type SavedCard } from "@/components/TemplateEditor";
import AuthModal from "@/components/AuthModal";
import CabinetPanel from "@/components/CabinetPanel";
import EmployerPanel from "@/components/EmployerPanel";
import DocumentsUploader from "@/components/DocumentsUploader";
import CompanyDocsList from "@/components/CompanyDocsList";
import CompanyContacts from "@/components/CompanyContacts";
import CompanyChat from "@/components/CompanyChat";
import EmployerSavedCards from "@/components/EmployerSavedCards";
import CustomTestBuilder from "@/components/CustomTestBuilder";
import BriefingEditor from "@/components/BriefingEditor";
import { useAuth } from "@/contexts/AuthContext";
import { uGet, uSet } from "@/utils/userStorage";

const NEWS_URL = "https://functions.poehali.dev/c3136b62-f96f-4c75-a5cf-4c4a43cad9db";
const DOCS_URL_CONST = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";

interface NewsItem {
  tag: string;
  title: string;
  description: string;
  url: string;
  date: string;
}

type Section = "home" | "info" | "tests" | "briefings" | "cabinet" | "employer" | "checklists" | "contacts" | "messages";
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

// ── Загрузка готового файла СОУТ/ПрофРиск ─────────────────────────────────────
function UploadSoutCard({ cardType, isSout, onUploaded }: { cardType: "sout" | "profrisk"; isSout: boolean; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const sid = () => { const m = document.cookie.match(/(?:^|;\s*)session_id=([^;]*)/); return m ? decodeURIComponent(m[1]) : ""; };

  const handleFile = async (file: File) => {
    setUploading(true);
    // 1. Создаём карточку-пустышку
    const title = file.name.replace(/\.[^.]+$/, "") || (isSout ? "Карта СОУТ" : "Карта рисков");
    const saveRes = await fetch(`${DOCS_URL_CONST}?action=card_save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cookie": `session_id=${sid()}` },
      body: JSON.stringify({ card_type: cardType, template_id: `${cardType}_file`, title, filled_values: {} }),
    });
    if (!saveRes.ok) { setToast("Ошибка создания карты"); setUploading(false); return; }
    const { card_id } = await saveRes.json();

    // 2. Загружаем файл
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const upRes = await fetch(`${DOCS_URL_CONST}?action=card_upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Cookie": `session_id=${sid()}` },
        body: JSON.stringify({ card_id, file_data: base64, file_name: file.name, content_type: file.type }),
      });
      setUploading(false);
      if (upRes.ok) { setToast("Файл загружен!"); onUploaded(); setTimeout(() => setToast(""), 3000); }
      else { setToast("Ошибка загрузки файла"); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} fallback="Circle" /> {toast}
        </div>
      )}
      <label className={`flex items-center gap-2 w-fit cursor-pointer px-4 py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""} ${isSout ? "border-green-300 text-green-700 hover:bg-green-50" : "border-amber-300 text-amber-700 hover:bg-amber-50"}`}>
        {uploading
          ? <><Icon name="Loader" size={15} className="animate-spin" fallback="Circle" /> Загружаем...</>
          : <><Icon name="Upload" size={15} fallback="Circle" /> Загрузить готовый файл</>}
        <input type="file" className="hidden" disabled={uploading}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </label>
      <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, изображения</p>
    </div>
  );
}

// ── Компонент раздела СОУТ / ПрофРисков ──────────────────────────────────────
interface SoutSectionProps {
  cardType: "sout" | "profrisk";
  templates: Template[];
  userRole?: string;
  userId?: number;
  editTemplate: Template | null;
  editSavedCard: SavedCard | null;
  viewCard: { template: Template; values: Record<string, string> } | null;
  onOpenTemplate: (tpl: Template) => void;
  onOpenSaved: (card: SavedCard) => void;
  onOpenView: (v: { template: Template; values: Record<string, string> }) => void;
  onBack: () => void;
  infoHint: ReactNode;
}

function SoutSection({ cardType, templates, userRole, userId, editTemplate, editSavedCard, viewCard, onOpenTemplate, onOpenSaved, onOpenView, onBack, infoHint }: SoutSectionProps) {
  const isSout = cardType === "sout";
  const isEmployer = userRole === "employer";
  const isEmployee = userRole === "employee";
  const [cardsKey, setCardsKey] = useState(0);

  // Если открыт редактор/просмотр — показываем его
  if (editTemplate) {
    return (
      <TemplateEditor
        template={editTemplate}
        onBack={onBack}
        userRole={isEmployer ? "employer" : "employee"}
        userId={userId}
      />
    );
  }
  if (editSavedCard) {
    const tpl = templates.find(t => t.id === editSavedCard.template_id) || templates[0];
    return (
      <TemplateEditor
        template={{ ...tpl, id: editSavedCard.template_id, title: editSavedCard.title }}
        onBack={onBack}
        userRole="employer"
        userId={userId}
        savedCard={editSavedCard}
      />
    );
  }
  if (viewCard) {
    return (
      <TemplateEditor
        template={viewCard.template}
        onBack={onBack}
        userRole="employee"
        userId={userId}
        readonlyValues={viewCard.values}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ── РАБОТОДАТЕЛЬ ── */}
      {isEmployer && (
        <>
          {/* Сохранённые карты */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <p className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isSout ? "text-green-700" : "text-amber-700"}`}>
                <Icon name="FolderOpen" size={13} fallback="Circle" />
                Сохранённые карты {isSout ? "СОУТ" : "ПрофРисков"}
              </p>
              <UploadSoutCard cardType={cardType} isSout={isSout} onUploaded={() => setCardsKey(k => k + 1)} />
            </div>
            <EmployerSavedCards key={cardsKey} cardType={cardType} onEdit={onOpenSaved} />
          </div>

          {/* Шаблоны для заполнения */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Создать новую карту</p>
            {infoHint}
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              {templates.map(tpl => (
                <div key={tpl.id} className="bg-white border border-border rounded-xl p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSout ? "bg-green-100" : "bg-amber-100"}`}>
                      <Icon name={isSout ? "ClipboardList" : "AlertOctagon"} size={16}
                        className={isSout ? "text-green-700" : "text-amber-700"} fallback="Circle" />
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSout ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {isSout ? "СОУТ" : "ПрофРиск"}
                    </span>
                    <span className={`text-xs ml-auto ${isSout ? "text-green-600" : "text-amber-600"}`}>{tpl.fields.length} полей</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-2 flex-1">{tpl.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{tpl.description}</p>
                  <button onClick={() => onOpenTemplate(tpl)}
                    className={`w-full py-2 text-sm rounded-lg text-white font-medium flex items-center justify-center gap-1.5 transition-colors ${isSout ? "bg-green-600 hover:bg-green-700" : "bg-amber-500 hover:bg-amber-600"}`}>
                    <Icon name="PenLine" size={13} fallback="Circle" />
                    {isSout ? "Заполнить карту СОУТ" : "Заполнить карту рисков"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── СОТРУДНИК ── */}
      {isEmployee && (
        <EmployeeCardsView cardType={cardType} templates={templates} onView={onOpenView} />
      )}

      {/* ── НЕ АВТОРИЗОВАН / НЕТ РОЛИ ── */}
      {!isEmployer && !isEmployee && (
        <div>
          {infoHint}
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-white border border-border rounded-xl p-5 flex flex-col">
                <h3 className="font-semibold text-sm mb-2 flex-1">{tpl.title}</h3>
                <p className="text-xs text-muted-foreground mb-4">{tpl.description}</p>
                <button onClick={() => onOpenTemplate(tpl)}
                  className={`w-full py-2 text-sm rounded-lg text-white font-medium flex items-center justify-center gap-1.5 ${isSout ? "bg-green-600 hover:bg-green-700" : "bg-amber-500 hover:bg-amber-600"}`}>
                  <Icon name="PenLine" size={13} fallback="Circle" />
                  {isSout ? "Заполнить карту СОУТ" : "Заполнить карту рисков"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Список карт для сотрудника (полученных от работодателя) ───────────────────
const DOCS_URL_INLINE = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";
function getCookieInline(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

interface EmployeeCardsViewProps {
  cardType: "sout" | "profrisk";
  templates: Template[];
  onView: (v: { template: Template; values: Record<string, string> }) => void;
}

function EmployeeCardsView({ cardType, templates, onView }: EmployeeCardsViewProps) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const isSout = cardType === "sout";

  useEffect(() => {
    const sid = getCookieInline("session_id");
    const headers = { "Content-Type": "application/json", ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}) };
    fetch(`${DOCS_URL_INLINE}?action=card_list&card_type=${cardType}`, { headers })
      .then(r => r.json())
      .then(d => setCards(d.cards || []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [cardType]);

  const markRead = async (cardId: number) => {
    const sid = getCookieInline("session_id");
    const headers = { "Content-Type": "application/json", ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}) };
    await fetch(`${DOCS_URL_INLINE}?action=card_mark_read`, {
      method: "POST", headers, body: JSON.stringify({ card_id: cardId }),
    });
    setCards(prev => prev.map(c => c.card_id === cardId ? { ...c, read_at: new Date().toISOString() } as SavedCard & { read_at: string } : c));
  };

  if (loading) return <div className="space-y-2">{[1,2].map(i=><div key={i} className="h-16 bg-muted animate-pulse rounded-xl"/>)}</div>;

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
        <Icon name="FileX" size={32} className="mx-auto mb-2 opacity-25" fallback="Circle" />
        <p className="text-sm">Карты от работодателя пока не поступали</p>
        <p className="text-xs mt-1 text-muted-foreground/60">Работодатель заполнит и отправит вам карту на ознакомление</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Карты {isSout ? "СОУТ" : "профессиональных рисков"}, направленные вам работодателем</p>
      {cards.map((card: SavedCard & { assigned_at?: string; read_at?: string | null }) => {
        const tpl = templates.find(t => t.id === card.template_id) || templates[0];
        const isRead = !!(card as Record<string, unknown>).read_at;
        return (
          <div key={card.card_id} className={`rounded-xl border p-4 ${isSout ? "bg-green-50/60 border-green-200" : "bg-amber-50/60 border-amber-200"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSout ? "bg-green-100" : "bg-amber-100"}`}>
                <Icon name={isSout ? "ClipboardList" : "AlertOctagon"} size={18}
                  className={isSout ? "text-green-700" : "text-amber-700"} fallback="Circle" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-sm">{card.title}</p>
                  {isRead ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                      <Icon name="CheckCircle" size={10} fallback="Check" /> Ознакомлен
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Требует ознакомления</span>
                  )}
                </div>
                {(card as Record<string, unknown>).assigned_at && (
                  <p className="text-xs text-muted-foreground">
                    Получена: {new Date((card as Record<string, unknown>).assigned_at as string).toLocaleDateString("ru-RU")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { if (tpl) onView({ template: { ...tpl, title: card.title }, values: card.filled_values }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted transition-colors font-medium">
                <Icon name="Eye" size={13} fallback="Circle" /> Открыть карту
              </button>
              {!isRead && (
                <button onClick={() => markRead(card.card_id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium text-white transition-colors ${isSout ? "bg-green-600 hover:bg-green-700" : "bg-amber-500 hover:bg-amber-600"}`}>
                  <Icon name="CheckCircle" size={13} fallback="Circle" /> Отметить ознакомленным
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
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
  const { user, unreadCount, loading: authLoading, completeTest, assignedTests,
    assignedBriefings, completeBriefing } = useAuth();
  const [authModal, setAuthModal] = useState<false | "login" | "register" | "forgot" | "reset">(false);
  const [resetToken, setResetToken] = useState("");
  const [avatarMenu, setAvatarMenu] = useState(false);

  // Автооткрытие модалки сброса пароля при ?reset_token=...
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset_token");
    if (token) {
      setResetToken(token);
      setAuthModal("reset");
    }
  }, []);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Закрываем меню при клике вне него
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
  const [checklistState, setChecklistState] = useState(CHECKLISTS_DATA);
  const [checklistNewText, setChecklistNewText] = useState<string[]>(CHECKLISTS_DATA.map(() => ""));
  const [notification, setNotification] = useState(true);
  const [chatReceiverId, setChatReceiverId] = useState<number | undefined>(undefined);
  const [chatSubject, setChatSubject] = useState<string>("");
  const [chatUnread, setChatUnread] = useState(0);

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
  const [editSavedCard, setEditSavedCard] = useState<SavedCard | null>(null);
  // Для сотрудника: просмотр карты, присланной работодателем
  const [viewCard, setViewCard] = useState<{ template: Template; values: Record<string, string> } | null>(null);
  const switchInfoTab = (tab: InfoTab) => { setInfoTab(tab); setEditTemplate(null); setEditSavedCard(null); setViewCard(null); setAddingTemplate(false); };
  const [openDocGroup, setOpenDocGroup] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplContent, setNewTplContent] = useState("");

  // Загружаем userTemplates при смене пользователя
  useEffect(() => {
    if (user?.id) {
      setUserTemplates(uGet(user.id, "userTemplates", []));
    } else {
      setUserTemplates([]);
    }
  }, [user?.id]);

  // Сохраняем userTemplates при изменении (только если есть user)
  useEffect(() => {
    if (user?.id) {
      uSet(user.id, "userTemplates", userTemplates);
    }
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
    // Сразу открываем редактор
    setEditTemplate(newTpl);
  };

  // Briefing state
  const [activeBriefingId, setActiveBriefingId] = useState<string | null>(null);
  const [completedBriefings, setCompletedBriefings] = useState<Set<string>>(new Set());
  const [briefingsTab, setBriefingsTab] = useState<"standard" | "custom">("standard");
  // Кастомный инструктаж для плеера (загруженный с сервера)
  const [customBriefingData, setCustomBriefingData] = useState<BriefingData | null>(null);

  // Test state
  const [testMode, setTestMode] = useState<TestMode>("list");
  const [activeTest, setActiveTest] = useState<TestData | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [completedTests, setCompletedTests] = useState<Record<string, number>>({});
  // Вкладка тестов (для работодателя: "standard" | "custom")
  const [testsTab, setTestsTab] = useState<"standard" | "custom">("standard");

  // Загружаем прогресс инструктажей и тестов при смене пользователя
  useEffect(() => {
    if (user?.id) {
      setCompletedBriefings(new Set(uGet<string[]>(user.id, "completedBriefings", [])));
      setCompletedTests(uGet<Record<string, number>>(user.id, "completedTests", {}));
      setChecklistState(uGet(user.id, "checklistState", CHECKLISTS_DATA));
    } else {
      // Гость — всё пустое
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
    // Сохраняем результат если назначен работодателем
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
              <div className="relative" ref={avatarMenuRef}>
                <button
                  onClick={() => setAvatarMenu(v => !v)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  {user.fio.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </button>
                {avatarMenu && (
                  <div
                    className="absolute right-0 top-10 z-[200] bg-white border border-border rounded-xl shadow-xl w-56 py-1 animate-fade-in"
                  >
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="font-medium text-sm truncate">{user.fio}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{user.role === "employer" ? "Работодатель" : "Сотрудник"}</p>
                    </div>
                    <button
                      onClick={() => { setAvatarMenu(false); navigate("cabinet"); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Icon name="UserCircle" size={15} fallback="Circle" />
                      Личный кабинет
                    </button>
                    {user.company_id && (
                      <button
                        onClick={() => { setAvatarMenu(false); setChatReceiverId(undefined); setChatSubject(""); navigate("messages"); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                      >
                        <Icon name="MessageSquare" size={15} fallback="Circle" />
                        Переписка
                        {chatUnread > 0 && (
                          <span className="ml-auto w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                            {chatUnread > 9 ? "9+" : chatUnread}
                          </span>
                        )}
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

            {(() => {
              const doneTests = Object.keys(completedTests).length;
              const totalTests = TESTS_DATA.length;
              const doneBriefings = completedBriefings.size;
              const totalBriefings = BRIEFINGS_DATA.length;
              const doneChecklists = checklistState.reduce((s, c) => s + c.items.filter(i => i.done).length, 0);
              const totalChecklists = checklistState.reduce((s, c) => s + c.items.length, 0);
              // Ближайший назначенный инструктаж с дедлайном
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
              );
            })()}

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
                  <TemplateEditor template={editTemplate} onBack={() => setEditTemplate(null)} userId={user?.id} userRole={user?.role} />
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-muted-foreground">Готовые шаблоны документов — заполняйте поля прямо на сайте</p>
                      <button onClick={() => setAddingTemplate(!addingTemplate)}
                        className="flex items-center gap-1.5 text-xs bg-primary text-white rounded-lg px-3 py-2 hover:bg-primary/90 transition-colors shrink-0">
                        <Icon name="Plus" size={13} fallback="Plus" /> Создать свой шаблон
                      </button>
                    </div>

                    {addingTemplate && (
                      <div className="bg-white border-2 border-primary/30 rounded-xl p-5 space-y-3">
                        <h3 className="font-medium text-sm flex items-center gap-2">
                          <Icon name="FilePlus" size={15} className="text-primary" fallback="Circle" />
                          Новый шаблон
                        </h3>
                        <p className="text-xs text-muted-foreground">Введите название и нажмите «Создать» — откроется редактор с форматированием</p>
                        <input
                          value={newTplTitle}
                          onChange={e => setNewTplTitle(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addUserTemplate()}
                          placeholder="Название документа, например: Акт осмотра рабочего места"
                          className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={addUserTemplate}
                            disabled={!newTplTitle.trim()}
                            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Создать и открыть редактор
                          </button>
                          <button onClick={() => { setAddingTemplate(false); setNewTplTitle(""); }}
                            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Мои шаблоны */}
                    {userTemplates.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Мои шаблоны</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          {userTemplates.map(tpl => (
                            <div key={tpl.id} className="bg-white border-2 border-primary/20 rounded-xl p-5 flex flex-col">
                              <div className="flex items-start justify-between mb-2 gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{tpl.category}</span>
                                <button
                                  onClick={() => {
                                    if (confirm(`Удалить шаблон «${tpl.title}»?`)) {
                                      setUserTemplates(prev => prev.filter(t => t.id !== tpl.id));
                                      // Удаляем сохранённые данные
                                      try {
                                        if (user?.id) {
                                          const key = `u_${user.id}_templateValues`;
                                          const all = JSON.parse(localStorage.getItem(key) || "{}");
                                          delete all[tpl.id];
                                          localStorage.setItem(key, JSON.stringify(all));
                                        }
                                      } catch { /* ignore */ }
                                    }
                                  }}
                                  className="p-1 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0"
                                  title="Удалить шаблон"
                                >
                                  <Icon name="Trash2" size={13} fallback="Trash" />
                                </button>
                              </div>
                              <h3 className="font-semibold text-sm mb-1 flex-1">{tpl.title}</h3>
                              <p className="text-xs text-muted-foreground mb-4">Создан вами · Редактор с форматированием</p>
                              <button
                                onClick={() => { setEditTemplate(tpl); }}
                                className="w-full py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-1.5"
                              >
                                <Icon name="FileEdit" size={13} fallback="Circle" /> Открыть редактор
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Готовые шаблоны */}
                    <div>
                      {userTemplates.length > 0 && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Готовые шаблоны</p>
                      )}
                      <div className="grid md:grid-cols-2 gap-4">
                        {TEMPLATES_DATA.map(tpl => (
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
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── МОИ СОУТ ── */}
            {infoTab === "Мои СОУТ" && (
              <SoutSection
                cardType="sout"
                templates={SOUT_TEMPLATES}
                userRole={user?.role}
                userId={user?.id}
                editTemplate={editTemplate}
                editSavedCard={editSavedCard}
                viewCard={viewCard}
                onOpenTemplate={tpl => { setEditSavedCard(null); setViewCard(null); setEditTemplate(tpl); }}
                onOpenSaved={card => { setEditTemplate(null); setViewCard(null); setEditSavedCard(card); }}
                onOpenView={v => { setEditTemplate(null); setEditSavedCard(null); setViewCard(v); }}
                onBack={() => { setEditTemplate(null); setEditSavedCard(null); setViewCard(null); }}
                infoHint={
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                    <Icon name="Info" size={16} className="text-blue-600 shrink-0 mt-0.5" fallback="Circle" />
                    <p className="text-sm text-blue-800">СОУТ проводится раз в 5 лет. Заполните карту по рабочему месту и сохраните или скачайте готовый документ.</p>
                  </div>
                }
              />
            )}

            {/* ── ПРОФРИСКИ ── */}
            {infoTab === "ПрофРиски" && (
              <SoutSection
                cardType="profrisk"
                templates={PROFRISK_TEMPLATES}
                userRole={user?.role}
                userId={user?.id}
                editTemplate={editTemplate}
                editSavedCard={editSavedCard}
                viewCard={viewCard}
                onOpenTemplate={tpl => { setEditSavedCard(null); setViewCard(null); setEditTemplate(tpl); }}
                onOpenSaved={card => { setEditTemplate(null); setViewCard(null); setEditSavedCard(card); }}
                onOpenView={v => { setEditTemplate(null); setEditSavedCard(null); setViewCard(v); }}
                onBack={() => { setEditTemplate(null); setEditSavedCard(null); setViewCard(null); }}
                infoHint={
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                    <Icon name="AlertTriangle" size={16} className="text-amber-600 shrink-0 mt-0.5" fallback="Circle" />
                    <p className="text-sm text-amber-800">Оценка профессиональных рисков обязательна (ст. 214 ТК РФ). Заполните карту и сохраните или скачайте документ.</p>
                  </div>
                }
              />
            )}
          </div>
        )}

        {active === "tests" && testMode === "list" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
              <h1 className="text-2xl font-semibold">Тестирование</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {user?.role === "employer" ? "Стандартные тесты и управление собственными" : "Программы обучения по охране труда"}
              </p>
            </div>

            {/* Вкладки для работодателя */}
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

            {/* Конструктор тестов для работодателя */}
            {user?.role === "employer" && testsTab === "custom" && (
              <CustomTestBuilder onBack={() => setTestsTab("standard")} />
            )}

            {/* Стандартные тесты */}
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

                  {/* Кастомные тесты назначенные сотруднику */}
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
              <p className="text-sm text-muted-foreground mt-0.5">
                {user?.role === "employer" ? "Стандартные инструктажи и управление собственными" : "Полные программы с текстом, видео и интерактивными заданиями"}
              </p>
            </div>

            {/* Вкладки для работодателя */}
            {user?.role === "employer" && (
              <div className="flex gap-1 border-b border-border">
                {([
                  { id: "standard", label: "Стандартные", icon: "BookOpen" },
                  { id: "custom",   label: "Мои инструктажи", icon: "Edit3" },
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

            {/* Редактор кастомных инструктажей */}
            {user?.role === "employer" && briefingsTab === "custom" && (
              <BriefingEditor
                onBack={() => setBriefingsTab("standard")}
                onPreview={(id) => startCustomBriefing(id)}
              />
            )}

            {/* Стандартные инструктажи */}
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

                {/* Инструктажи от работодателя (для сотрудника) */}
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

        {active === "briefings" && activeBriefingId && (() => {
          // Кастомный инструктаж — загружен с сервера
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
          // Стандартный инструктаж
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

        {active === "cabinet" && (
          user ? (
            <CabinetPanel
              onStartTest={(testId) => {
                const t = TESTS_DATA.find(td => td.id === testId);
                if (t) { startTest(t); navigate("tests"); }
              }}
              onLogout={() => navigate("home")}
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

                    {/* Добавление пункта — только для авторизованных */}
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
      </main>

      {/* AuthModal */}
      {authModal && (
        <AuthModal
          initialMode={authModal}
          resetToken={resetToken}
          onClose={() => { setAuthModal(false); setResetToken(""); }}
        />
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
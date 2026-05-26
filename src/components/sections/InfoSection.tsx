import { useState, useEffect, type ReactNode } from "react";
import Icon from "@/components/ui/icon";
import TemplateEditor, { type SavedCard } from "@/components/TemplateEditor";
import EmployerSavedCards from "@/components/EmployerSavedCards";
import {
  DOCUMENTS_DATA,
  TEMPLATES_DATA,
  SOUT_TEMPLATES,
  PROFRISK_TEMPLATES,
  type Template,
} from "@/data/infoData";
import { useAuth } from "@/contexts/AuthContext";
import { uGet, uSet } from "@/utils/userStorage";

const DOCS_URL_CONST = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";
const DOCS_URL_INLINE = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";

function getCookieInline(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function UploadSoutCard({ cardType, isSout, onUploaded }: { cardType: "sout" | "profrisk"; isSout: boolean; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const sid = () => { const m = document.cookie.match(/(?:^|;\s*)session_id=([^;]*)/); return m ? decodeURIComponent(m[1]) : ""; };

  const handleFile = async (file: File) => {
    setUploading(true);
    const title = file.name.replace(/\.[^.]+$/, "") || (isSout ? "Карта СОУТ" : "Карта рисков");
    const saveRes = await fetch(`${DOCS_URL_CONST}?action=card_save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cookie": `session_id=${sid()}` },
      body: JSON.stringify({ card_type: cardType, template_id: `${cardType}_file`, title, filled_values: {} }),
    });
    if (!saveRes.ok) { setToast("Ошибка создания карты"); setUploading(false); return; }
    const { card_id } = await saveRes.json();

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
      {isEmployer && (
        <>
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

      {isEmployee && (
        <EmployeeCardsView cardType={cardType} templates={templates} onView={onOpenView} />
      )}

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

const INFO_TABS = ["Новости", "Документация", "Справочники", "Мои СОУТ", "ПрофРиски"] as const;
type InfoTab = typeof INFO_TABS[number];

interface InfoSectionProps {
  infoTab: InfoTab;
  switchInfoTab: (tab: InfoTab) => void;
  news: { tag: string; title: string; description: string; url: string; date: string }[];
  newsLoading: boolean;
  newsFilter: string;
  setNewsFilter: (v: string) => void;
  filteredNews: { tag: string; title: string; description: string; url: string; date: string }[];
  openDocGroup: string | null;
  setOpenDocGroup: (v: string | null) => void;
  editTemplate: Template | null;
  setEditTemplate: (v: Template | null) => void;
  editSavedCard: SavedCard | null;
  setEditSavedCard: (v: SavedCard | null) => void;
  viewCard: { template: Template; values: Record<string, string> } | null;
  setViewCard: (v: { template: Template; values: Record<string, string> } | null) => void;
  userTemplates: Template[];
  setUserTemplates: (fn: (prev: Template[]) => Template[]) => void;
  addingTemplate: boolean;
  setAddingTemplate: (v: boolean) => void;
  newTplTitle: string;
  setNewTplTitle: (v: string) => void;
  newTplContent: string;
  setNewTplContent: (v: string) => void;
  addUserTemplate: () => void;
}

export default function InfoSection({
  infoTab,
  switchInfoTab,
  news,
  newsLoading,
  newsFilter,
  setNewsFilter,
  filteredNews,
  openDocGroup,
  setOpenDocGroup,
  editTemplate,
  setEditTemplate,
  editSavedCard,
  setEditSavedCard,
  viewCard,
  setViewCard,
  userTemplates,
  setUserTemplates,
  addingTemplate,
  setAddingTemplate,
  newTplTitle,
  setNewTplTitle,
  newTplContent,
  setNewTplContent,
  addUserTemplate,
}: InfoSectionProps) {
  const { user } = useAuth();
  const newsFilters = ["Все", "Новость", "Надзор", "Мероприятие"];

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
        <h1 className="text-2xl font-semibold">Информация</h1>
      </div>

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

              <div>
                {userTemplates.length > 0 && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Готовые шаблоны</p>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  {TEMPLATES_DATA.map(tpl => (
                    <div key={tpl.id} className="bg-white border border-border rounded-xl p-5 flex flex-col">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{tpl.category}</span>
                        <span className="text-xs text-muted-foreground">{tpl.fields.length} полей</span>
                      </div>
                      <h3 className="font-semibold text-sm mb-1 flex-1">{tpl.title}</h3>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{tpl.description}</p>
                      <button
                        onClick={() => setEditTemplate(tpl)}
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
  );
}

export { INFO_TABS };
export type { InfoTab };
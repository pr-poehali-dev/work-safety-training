import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { SavedCard } from "@/components/TemplateEditor";

const DOCS_URL = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";
const EMPLOYER_URL = "https://functions.poehali.dev/2db38725-d446-4c74-8d25-b78ef3437142";

function getCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}
function authH() {
  const sid = getCookie("session_id");
  return { "Content-Type": "application/json", ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}) };
}
async function apiFetch(url: string, action: string, opts: RequestInit = {}, qs: Record<string, string> = {}) {
  const p = new URLSearchParams({ action, ...qs });
  return fetch(`${url}?${p}`, { ...opts, headers: { ...authH(), ...(opts.headers as Record<string, string> || {}) } });
}

interface Employee { id: number; fio: string; email: string; }

interface Props {
  cardType: "sout" | "profrisk";
  onEdit: (card: SavedCard) => void;
}

export default function EmployerSavedCards({ cardType, onEdit }: Props) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  // Assign modal state
  const [assignCardId, setAssignCardId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Загрузка файла
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(DOCS_URL, "card_list", {}, { card_type: cardType });
    if (res.ok) {
      const d = await res.json();
      // Бэкенд возвращает "id", фронтенд ожидает "card_id"
      setCards((d.cards || []).map((c: SavedCard & { id?: number }) => ({
        ...c,
        card_id: c.card_id ?? c.id,
      })));
    }
    setLoading(false);
  }, [cardType]);

  useEffect(() => { load(); }, [load]);

  const deleteCard = async (card: SavedCard) => {
    if (!confirm(`Удалить карту «${card.title}»? Это действие нельзя отменить.`)) return;
    setDeletingId(card.card_id);
    const res = await apiFetch(DOCS_URL, "card_delete", {
      method: "POST",
      body: JSON.stringify({ card_id: card.card_id }),
    });
    setDeletingId(null);
    if (res.ok) {
      setCards(prev => prev.filter(c => c.card_id !== card.card_id));
      showToast("Карта удалена");
    } else {
      showToast("Ошибка удаления");
    }
  };

  const loadEmployees = async (q = "") => {
    const res = await apiFetch(EMPLOYER_URL, "employees", {}, q ? { q } : {});
    if (res.ok) { const d = await res.json(); setEmployees(d.employees || []); }
  };

  const uploadFile = async (card: SavedCard, file: File) => {
    setUploadingId(card.card_id);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await apiFetch(DOCS_URL, "card_upload", {
        method: "POST",
        body: JSON.stringify({
          card_id: card.card_id,
          file_data: base64,
          file_name: file.name,
          content_type: file.type || "application/octet-stream",
        }),
      });
      const data = await res.json();
      setUploadingId(null);
      if (res.ok) {
        setCards(prev => prev.map(c =>
          c.card_id === card.card_id
            ? { ...c, file_url: data.file_url, file_name: data.file_name }
            : c
        ));
        showToast("Файл загружен");
      } else {
        showToast(data.error || "Ошибка загрузки");
      }
    };
    reader.readAsDataURL(file);
  };

  const openAssign = async (cardId: number) => {
    setAssignCardId(cardId);
    setSelectedEmps([]);
    setEmpSearch("");
    await loadEmployees();
  };

  const sendToEmployees = async () => {
    if (!assignCardId || selectedEmps.length === 0) return;
    setAssigning(true);
    const res = await apiFetch(DOCS_URL, "card_assign", {
      method: "POST",
      body: JSON.stringify({ card_id: assignCardId, employee_ids: selectedEmps }),
    });
    const data = await res.json();
    setAssigning(false);
    if (res.ok) {
      showToast(`Карта отправлена ${data.assigned_to} сотруднику(ам)`);
      setAssignCardId(null);
      setSelectedEmps([]);
      load();
    } else {
      showToast(data.error || "Ошибка отправки");
    }
  };

  const isSout = cardType === "sout";

  if (loading) {
    return <div className="space-y-2">{["a", "b"].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>;
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} fallback="Circle" /> {toast}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
          <Icon name="FileX" size={28} className="mx-auto mb-2 opacity-25" fallback="Circle" />
          <p className="text-sm">Сохранённых карт нет</p>
          <p className="text-xs mt-1">Заполните шаблон и нажмите «Сохранить карту»</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map(card => {
            const sentTo = card.assignments?.length || 0;
            const readBy = card.assignments?.filter(a => a.read_at).length || 0;
            const isDeleting = deletingId === card.card_id;

            const isUploading = uploadingId === card.card_id;
            const fileInputId = `file-input-${card.card_id}`;

            return (
              <div key={card.card_id} className={`rounded-xl border p-4 transition-opacity ${isSout ? "bg-green-50/60 border-green-200" : "bg-amber-50/60 border-amber-200"} ${isDeleting ? "opacity-40" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isSout ? "bg-green-100" : "bg-amber-100"}`}>
                    <Icon name={isSout ? "ClipboardList" : "AlertOctagon"} size={18}
                      className={isSout ? "text-green-700" : "text-amber-700"} fallback="Circle" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug">{card.title}</p>
                    {sentTo > 0 ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Отправлено: <span className="font-medium">{sentTo}</span> · Ознакомились: <span className="font-medium text-green-700">{readBy}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Ещё не отправлена сотрудникам</p>
                    )}
                    {/* Прикреплённый файл */}
                    {card.file_url && (
                      <a href={card.file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                        <Icon name="Paperclip" size={11} fallback="Circle" />
                        {card.file_name || "Файл"}
                      </a>
                    )}
                  </div>

                  {/* Кнопки управления */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => openAssign(card.card_id)}
                      title="Отправить сотруднику"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg font-medium text-white transition-colors ${isSout ? "bg-green-600 hover:bg-green-700" : "bg-amber-500 hover:bg-amber-600"}`}
                    >
                      <Icon name="Send" size={12} fallback="Circle" /> Отправить
                    </button>
                    <button
                      onClick={() => onEdit(card)}
                      title="Открыть и редактировать"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-primary/30 bg-white hover:bg-primary/5 text-primary transition-colors"
                    >
                      <Icon name="FileEdit" size={12} fallback="Circle" /> Открыть
                    </button>
                    {/* Загрузить файл */}
                    <label htmlFor={fileInputId} title={card.file_url ? "Заменить файл" : "Прикрепить файл"}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg border bg-white transition-colors cursor-pointer ${isUploading ? "opacity-40 pointer-events-none" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
                      {isUploading
                        ? <Icon name="Loader" size={13} className="animate-spin" fallback="Circle" />
                        : <Icon name="Paperclip" size={13} fallback="Circle" />}
                    </label>
                    <input id={fileInputId} type="file" className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(card, f); e.target.value = ""; }} />
                    <button
                      onClick={() => deleteCard(card)}
                      disabled={isDeleting}
                      title="Удалить карту"
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                    >
                      <Icon name="Trash2" size={13} fallback="Trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модалка отправки */}
      {assignCardId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAssignCardId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Icon name="Send" size={16} className="text-primary" fallback="Circle" />
                Отправить карту сотруднику
              </h3>
              <button onClick={() => setAssignCardId(null)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <Icon name="X" size={16} fallback="X" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              «{cards.find(c => c.card_id === assignCardId)?.title}»
            </p>

            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fallback="Circle" />
              <input
                value={empSearch}
                onChange={e => { setEmpSearch(e.target.value); loadEmployees(e.target.value); }}
                placeholder="Поиск по ФИО..."
                className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Сотрудников не найдено</p>
              ) : employees.map(emp => {
                const selected = selectedEmps.includes(emp.id);
                return (
                  <button key={emp.id}
                    onClick={() => setSelectedEmps(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id])}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0 ${selected ? "bg-primary/5" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
                      {selected && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.fio}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedEmps.length > 0 && (
              <p className="text-xs text-primary font-medium flex items-center gap-1">
                <Icon name="Users" size={12} fallback="Circle" /> Выбрано: {selectedEmps.length} сотрудника(ов)
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={sendToEmployees}
                disabled={assigning || selectedEmps.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {assigning ? "Отправляем..." : `Отправить (${selectedEmps.length})`}
              </button>
              <button onClick={() => setAssignCardId(null)} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
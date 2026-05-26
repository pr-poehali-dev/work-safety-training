import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { BRIEFINGS_DATA, type Block, type BriefingData } from "@/data/briefings";

const EMPLOYER_URL = "https://functions.poehali.dev/2db38725-d446-4c74-8d25-b78ef3437142";

function getCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}
function authH() {
  const sid = getCookie("session_id");
  return { "Content-Type": "application/json", ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}) };
}
function apiFetch(action: string, opts: RequestInit = {}, qs: Record<string, string> = {}) {
  const p = new URLSearchParams({ action, ...qs });
  return fetch(`${EMPLOYER_URL}?${p}`, { ...opts, headers: { ...authH(), ...(opts.headers as Record<string, string> || {}) } });
}

// ─── типы ─────────────────────────────────────────────────────────────────────
interface EditableBlock {
  id?: number;
  type: Block["type"];
  // text / warning / info
  title?: string;
  content?: string;
  // video
  youtubeId?: string;
  vkVideo?: string;
  dzenUrl?: string;
  duration?: string;
  description?: string;
  // task_quiz
  question?: string;
  options?: string[];
  correct?: number;
  explanation?: string;
  // task_match
  instruction?: string;
  pairs?: { left: string; right: string }[];
  // task_sort
  items?: { text: string; correct: boolean }[];
}

interface CustomBriefing {
  id: number;
  title: string;
  subtitle: string;
  duration: number;
  source_briefing_id: string;
  source_variant_id: string;
  block_count: number;
  updated_at: string;
}

interface Props {
  onBack: () => void;
  onPreview?: (id: number) => void;
}

type View = "list" | "editor" | "assign" | "progress";

const BLOCK_TYPE_LABELS: Record<Block["type"], string> = {
  text: "Текст",
  warning: "Предупреждение",
  info: "Информация",
  video: "Видео",
  task_quiz: "Тест: одиночный вопрос",
  task_match: "Задание: сопоставление",
  task_sort: "Задание: выбор правильных",
};

const BLOCK_ICONS: Record<Block["type"], string> = {
  text: "FileText",
  warning: "AlertTriangle",
  info: "Info",
  video: "Play",
  task_quiz: "HelpCircle",
  task_match: "ArrowLeftRight",
  task_sort: "CheckSquare",
};

function emptyBlock(type: Block["type"]): EditableBlock {
  switch (type) {
    case "text": return { type, title: "", content: "" };
    case "warning": return { type, title: "", content: "" };
    case "info": return { type, title: "", content: "" };
    case "video": return { type, title: "", duration: "10:00", description: "", youtubeId: "" };
    case "task_quiz": return { type, title: "Проверь себя", question: "", options: ["", "", "", ""], correct: 0, explanation: "" };
    case "task_match": return { type, title: "Задание: сопоставление", instruction: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
    case "task_sort": return { type, title: "Задание: выбор", instruction: "", items: [{ text: "", correct: true }, { text: "", correct: false }] };
  }
}

function blocksFromBriefing(b: BriefingData, variantId?: string): EditableBlock[] {
  const raw = variantId
    ? (b.variants?.find(v => v.id === variantId)?.blocks ?? b.blocks ?? [])
    : (b.blocks ?? []);
  return raw.map(bl => ({ ...bl }) as EditableBlock);
}

// ─── Редактор одного блока ────────────────────────────────────────────────────
function BlockEditor({ block, onChange, onDelete, onUp, onDown, isFirst, isLast }: {
  block: EditableBlock;
  onChange: (b: EditableBlock) => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(true);
  const set = (patch: Partial<EditableBlock>) => onChange({ ...block, ...patch });

  const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors";
  const textareaCls = `${inputCls} resize-none`;

  return (
    <div className={`border rounded-xl overflow-hidden ${
      block.type === "warning" ? "border-red-200" :
      block.type === "info" ? "border-blue-200" :
      block.type.startsWith("task") ? "border-amber-200" :
      block.type === "video" ? "border-purple-200" :
      "border-border"
    }`}>
      {/* Шапка блока */}
      <div className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none ${
        block.type === "warning" ? "bg-red-50" :
        block.type === "info" ? "bg-blue-50" :
        block.type.startsWith("task") ? "bg-amber-50" :
        block.type === "video" ? "bg-purple-50" :
        "bg-muted/40"
      }`} onClick={() => setOpen(o => !o)}>
        <Icon name={BLOCK_ICONS[block.type] as "FileText"} size={13} className="text-muted-foreground shrink-0" fallback="Circle" />
        <span className="text-xs font-medium flex-1 truncate">
          {BLOCK_TYPE_LABELS[block.type]}
          {(block.title || block.question) && <span className="text-muted-foreground ml-1.5 font-normal">— {block.title || block.question}</span>}
        </span>
        <div className="flex items-center gap-0.5 ml-auto" onClick={e => e.stopPropagation()}>
          <button disabled={isFirst} onClick={onUp} className="p-1 rounded hover:bg-white/70 disabled:opacity-30 transition-colors">
            <Icon name="ChevronUp" size={13} fallback="ChevronUp" />
          </button>
          <button disabled={isLast} onClick={onDown} className="p-1 rounded hover:bg-white/70 disabled:opacity-30 transition-colors">
            <Icon name="ChevronDown" size={13} fallback="ChevronDown" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors ml-1">
            <Icon name="Trash2" size={13} fallback="Trash" />
          </button>
          <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} className="text-muted-foreground ml-1" fallback="ChevronDown" />
        </div>
      </div>

      {open && (
        <div className="p-4 bg-white space-y-3">
          {/* TEXT / WARNING / INFO */}
          {(block.type === "text" || block.type === "warning" || block.type === "info") && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Заголовок</label>
                <input value={block.title || ""} onChange={e => set({ title: e.target.value })}
                  placeholder="Заголовок блока" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Текст <span className="text-muted-foreground font-normal">(поддерживается **жирный** текст и • маркеры)</span></label>
                <textarea value={block.content || ""} onChange={e => set({ content: e.target.value })}
                  rows={5} placeholder="Содержимое блока..." className={textareaCls} />
              </div>
            </>
          )}

          {/* VIDEO */}
          {block.type === "video" && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Название</label>
                <input value={block.title || ""} onChange={e => set({ title: e.target.value })}
                  placeholder="Название видео" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Описание</label>
                <input value={block.description || ""} onChange={e => set({ description: e.target.value })}
                  placeholder="Краткое описание видео" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Длительность</label>
                  <input value={block.duration || ""} onChange={e => set({ duration: e.target.value })}
                    placeholder="10:00" className={inputCls} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium">Источник видео <span className="text-muted-foreground font-normal">(заполните одно из полей)</span></label>
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">RuTube ID</label>
                  <input value={block.youtubeId || ""} onChange={e => set({ youtubeId: e.target.value, vkVideo: "", dzenUrl: "" })}
                    placeholder="fbc7386b51873ae99..." className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">VK Video (формат: oid_id, например -233338473_456239017)</label>
                  <input value={block.vkVideo || ""} onChange={e => set({ vkVideo: e.target.value, youtubeId: "", dzenUrl: "" })}
                    placeholder="-233338473_456239017" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">Яндекс Дзен (полная ссылка)</label>
                  <input value={block.dzenUrl || ""} onChange={e => set({ dzenUrl: e.target.value, youtubeId: "", vkVideo: "" })}
                    placeholder="https://dzen.ru/video/watch/..." className={inputCls} />
                </div>
              </div>
            </>
          )}

          {/* TASK_QUIZ */}
          {block.type === "task_quiz" && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Заголовок задания</label>
                <input value={block.title || ""} onChange={e => set({ title: e.target.value })}
                  placeholder="Проверь себя" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Вопрос *</label>
                <textarea value={block.question || ""} onChange={e => set({ question: e.target.value })}
                  rows={2} placeholder="Текст вопроса..." className={textareaCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">Варианты ответов <span className="text-primary">(отметьте правильный)</span></label>
                <div className="space-y-2">
                  {(block.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button onClick={() => set({ correct: oi })}
                        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${block.correct === oi ? "border-primary bg-primary" : "border-border hover:border-primary/50"}`}>
                        {block.correct === oi && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                      </button>
                      <input value={opt} onChange={e => set({ options: (block.options || []).map((o, i) => i === oi ? e.target.value : o) })}
                        placeholder={`Вариант ${oi + 1}`} className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
                      {(block.options || []).length > 2 && (
                        <button onClick={() => set({ options: (block.options || []).filter((_, i) => i !== oi), correct: Math.min(block.correct || 0, (block.options || []).length - 2) })}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
                          <Icon name="Minus" size={12} fallback="Minus" />
                        </button>
                      )}
                    </div>
                  ))}
                  {(block.options || []).length < 6 && (
                    <button onClick={() => set({ options: [...(block.options || []), ""] })}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      <Icon name="Plus" size={11} fallback="Circle" /> Добавить вариант
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Пояснение к ответу</label>
                <textarea value={block.explanation || ""} onChange={e => set({ explanation: e.target.value })}
                  rows={2} placeholder="Объяснение правильного ответа..." className={textareaCls} />
              </div>
            </>
          )}

          {/* TASK_MATCH */}
          {block.type === "task_match" && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Заголовок</label>
                <input value={block.title || ""} onChange={e => set({ title: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Инструкция</label>
                <input value={block.instruction || ""} onChange={e => set({ instruction: e.target.value })}
                  placeholder="Соотнесите левый столбец с правым" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">Пары для сопоставления</label>
                <div className="space-y-2">
                  {(block.pairs || []).map((pair, pi) => (
                    <div key={pi} className="flex items-center gap-2">
                      <input value={pair.left} onChange={e => set({ pairs: (block.pairs || []).map((p, i) => i === pi ? { ...p, left: e.target.value } : p) })}
                        placeholder="Левый" className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
                      <Icon name="ArrowRight" size={13} className="text-muted-foreground shrink-0" fallback="Circle" />
                      <input value={pair.right} onChange={e => set({ pairs: (block.pairs || []).map((p, i) => i === pi ? { ...p, right: e.target.value } : p) })}
                        placeholder="Правый" className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
                      {(block.pairs || []).length > 2 && (
                        <button onClick={() => set({ pairs: (block.pairs || []).filter((_, i) => i !== pi) })}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
                          <Icon name="X" size={12} fallback="X" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => set({ pairs: [...(block.pairs || []), { left: "", right: "" }] })}
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Icon name="Plus" size={11} fallback="Circle" /> Добавить пару
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TASK_SORT */}
          {block.type === "task_sort" && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Заголовок</label>
                <input value={block.title || ""} onChange={e => set({ title: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Инструкция</label>
                <input value={block.instruction || ""} onChange={e => set({ instruction: e.target.value })}
                  placeholder="Отметьте правильные варианты" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">Элементы <span className="text-muted-foreground font-normal">(отметьте правильные)</span></label>
                <div className="space-y-2">
                  {(block.items || []).map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <button onClick={() => set({ items: (block.items || []).map((it, i) => i === ii ? { ...it, correct: !it.correct } : it) })}
                        className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${item.correct ? "bg-primary border-primary" : "border-border hover:border-primary/50"}`}>
                        {item.correct && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                      </button>
                      <input value={item.text} onChange={e => set({ items: (block.items || []).map((it, i) => i === ii ? { ...it, text: e.target.value } : it) })}
                        placeholder={`Вариант ${ii + 1}`} className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
                      {(block.items || []).length > 2 && (
                        <button onClick={() => set({ items: (block.items || []).filter((_, i) => i !== ii) })}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
                          <Icon name="X" size={12} fallback="X" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => set({ items: [...(block.items || []), { text: "", correct: false }] })}
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Icon name="Plus" size={11} fallback="Circle" /> Добавить элемент
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Интерфейсы для назначения/статистики ─────────────────────────────────────
interface Employee { id: number; fio: string; email: string; }
interface ProgressRow { id: number; fio: string; email: string; assigned_at: string; due_date: string | null; completed_at: string | null; }

// ─── Главный компонент ─────────────────────────────────────────────────────────
export default function BriefingEditor({ onBack, onPreview }: Props) {
  const [view, setView] = useState<View>("list");
  const [briefings, setBriefings] = useState<CustomBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Поля редактора
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);

  // Панель добавления блока
  const [addOpen, setAddOpen] = useState(false);

  // Назначение
  const [assignBriefing, setAssignBriefing] = useState<CustomBriefing | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Статистика
  const [progressBriefing, setProgressBriefing] = useState<CustomBriefing | null>(null);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("briefing_list");
    if (res.ok) {
      const d = await res.json();
      setBriefings((d.briefings || []).filter((b: CustomBriefing) => !b.title.startsWith("[УДАЛЁН]")));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAssign = async (b: CustomBriefing) => {
    setAssignBriefing(b);
    setSelectedEmps([]); setDueDate(""); setEmpSearch("");
    const res = await apiFetch("employees");
    if (res.ok) { const d = await res.json(); setEmployees(d.employees || []); }
    setView("assign");
  };

  const sendAssign = async () => {
    if (!assignBriefing || selectedEmps.length === 0) return;
    setAssigning(true);
    const res = await apiFetch("briefing_assign", {
      method: "POST",
      body: JSON.stringify({ briefing_id: assignBriefing.id, employee_ids: selectedEmps, due_date: dueDate || null }),
    });
    const d = await res.json();
    setAssigning(false);
    if (res.ok) { showToast(`Инструктаж назначен ${d.assigned} сотруднику(ам)`); setView("list"); }
    else showToast(d.error || "Ошибка назначения");
  };

  const openProgress = async (b: CustomBriefing) => {
    setProgressBriefing(b);
    setProgressLoading(true);
    setView("progress");
    const res = await apiFetch("briefing_progress", {}, { id: String(b.id) });
    if (res.ok) { const d = await res.json(); setProgressRows(d.progress || []); }
    setProgressLoading(false);
  };

  const openNew = () => {
    setEditId(null);
    setTitle(""); setSubtitle(""); setDuration(30); setBlocks([]);
    setView("editor");
  };

  const openEdit = async (b: CustomBriefing) => {
    const res = await apiFetch("briefing_get", {}, { id: String(b.id) });
    if (!res.ok) { showToast("Ошибка загрузки"); return; }
    const d = await res.json();
    setEditId(b.id);
    setTitle(d.briefing.title);
    setSubtitle(d.briefing.subtitle);
    setDuration(d.briefing.duration);
    setBlocks(d.briefing.blocks || []);
    setView("editor");
  };

  const importFromStandard = (briefingId: string, variantId?: string) => {
    const b = BRIEFINGS_DATA.find(br => br.id === briefingId);
    if (!b) return;
    const imported = blocksFromBriefing(b, variantId);
    setBlocks(imported);
    if (!title) setTitle(b.title + (variantId ? ` (${b.variants?.find(v => v.id === variantId)?.label || variantId})` : ""));
    if (!subtitle) setSubtitle(b.subtitle);
    if (!duration) setDuration(b.duration);
    showToast(`Импортировано ${imported.length} блоков`);
  };

  const deleteBriefing = async (b: CustomBriefing) => {
    if (!confirm(`Удалить инструктаж «${b.title}»?`)) return;
    const res = await apiFetch("briefing_delete", { method: "POST", body: JSON.stringify({ id: b.id }) });
    if (res.ok) { showToast("Удалено"); load(); }
    else showToast("Ошибка удаления");
  };

  const save = async () => {
    if (!title.trim()) { showToast("Введите название"); return; }
    if (blocks.length === 0) { showToast("Добавьте хотя бы один блок"); return; }
    setSaving(true);
    const res = await apiFetch("briefing_save", {
      method: "POST",
      body: JSON.stringify({ id: editId, title, subtitle, duration, blocks }),
    });
    setSaving(false);
    if (res.ok) {
      showToast(editId ? "Сохранено" : "Инструктаж создан");
      setView("list");
      load();
    } else {
      const d = await res.json();
      showToast(d.error || "Ошибка сохранения");
    }
  };

  const moveBlock = (i: number, dir: -1 | 1) => {
    setBlocks(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const updateBlock = (i: number, b: EditableBlock) => setBlocks(prev => prev.map((bl, idx) => idx === i ? b : bl));
  const deleteBlock = (i: number) => setBlocks(prev => prev.filter((_, idx) => idx !== i));
  const addBlock = (type: Block["type"]) => { setBlocks(prev => [...prev, emptyBlock(type)]); setAddOpen(false); };

  // ── СПИСОК ──────────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} fallback="Circle" /> {toast}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Мои инструктажи</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Создавайте кастомные инструктажи на основе стандартных или с нуля</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="ArrowLeft" size={14} fallback="Circle" /> К стандартным
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
            <Icon name="Plus" size={14} fallback="Circle" /> Создать
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : briefings.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <Icon name="BookOpen" size={40} className="mx-auto mb-3 opacity-20" fallback="Circle" />
          <p className="font-medium text-sm">Инструктажей пока нет</p>
          <p className="text-xs mt-1 mb-4">Создайте инструктаж на основе стандартного или с нуля</p>
          <button onClick={openNew} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors">
            Создать инструктаж
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map(b => (
            <div key={b.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{b.title}</p>
                  {b.subtitle && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.subtitle}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Icon name="Layers" size={11} fallback="Circle" />{b.block_count} блоков</span>
                    <span className="flex items-center gap-1"><Icon name="Clock" size={11} fallback="Circle" />{b.duration} мин</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <button onClick={() => openAssign(b)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 font-medium transition-colors">
                    <Icon name="Send" size={12} fallback="Circle" /> Назначить
                  </button>
                  <button onClick={() => openProgress(b)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-primary/40 text-primary hover:bg-primary/5 transition-colors">
                    <Icon name="BarChart2" size={12} fallback="Circle" /> Прогресс
                  </button>
                  {onPreview && (
                    <button onClick={() => onPreview(b.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                      <Icon name="Play" size={12} fallback="Circle" /> Просмотр
                    </button>
                  )}
                  <button onClick={() => openEdit(b)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                    <Icon name="Pencil" size={12} fallback="Circle" /> Изменить
                  </button>
                  <button onClick={() => deleteBriefing(b)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-200 hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                    <Icon name="Trash2" size={13} fallback="Trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── НАЗНАЧИТЬ ─────────────────────────────────────────────────────────────
  if (view === "assign") {
    const filteredEmps = employees.filter(e =>
      !empSearch || e.fio.toLowerCase().includes(empSearch.toLowerCase()) || e.email.toLowerCase().includes(empSearch.toLowerCase())
    );
    return (
      <div className="space-y-4">
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
            <Icon name="CheckCircle" size={15} fallback="Circle" /> {toast}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="ArrowLeft" size={16} fallback="Circle" />
          </button>
          <div>
            <h2 className="font-semibold text-base">Назначить инструктаж</h2>
            <p className="text-xs text-muted-foreground">«{assignBriefing?.title}»</p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Срок выполнения <span className="text-muted-foreground font-normal">(необязательно)</span></label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2">Выберите сотрудников *</label>
            <div className="relative mb-2">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fallback="Circle" />
              <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                placeholder="Поиск по ФИО или email..."
                className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div className="border border-border rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              {filteredEmps.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Сотрудников не найдено</p>
              ) : filteredEmps.map(emp => {
                const sel = selectedEmps.includes(emp.id);
                return (
                  <button key={emp.id}
                    onClick={() => setSelectedEmps(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id])}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/50 last:border-0 ${sel ? "bg-primary/5" : "hover:bg-muted/40"}`}>
                    <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${sel ? "bg-primary border-primary" : "border-border"}`}>
                      {sel && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
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
              <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1">
                <Icon name="Users" size={12} fallback="Circle" /> Выбрано: {selectedEmps.length}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={sendAssign} disabled={assigning || selectedEmps.length === 0}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {assigning ? "Отправляем..." : `Назначить (${selectedEmps.length})`}
          </button>
          <button onClick={() => setView("list")} className="px-5 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
            Отмена
          </button>
        </div>
      </div>
    );
  }

  // ── ПРОГРЕСС ──────────────────────────────────────────────────────────────
  if (view === "progress") {
    const done = progressRows.filter(r => r.completed_at).length;
    const total = progressRows.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="space-y-4">
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
            <Icon name="CheckCircle" size={15} fallback="Circle" /> {toast}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="ArrowLeft" size={16} fallback="Circle" />
          </button>
          <div>
            <h2 className="font-semibold text-base">Прогресс прохождения</h2>
            <p className="text-xs text-muted-foreground">«{progressBriefing?.title}»</p>
          </div>
        </div>

        {/* Сводка */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Назначено", value: total, icon: "Users", color: "text-foreground" },
            { label: "Пройдено", value: done, icon: "CheckCircle", color: "text-green-600" },
            { label: "Ожидает", value: total - done, icon: "Clock", color: "text-amber-600" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4 text-center">
              <Icon name={s.icon as "Users"} size={20} className={`mx-auto mb-1 ${s.color}`} fallback="Circle" />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {total > 0 && (
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Общий прогресс</span>
              <span className="text-xs font-bold text-primary">{pct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Список */}
        {progressLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : progressRows.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl text-muted-foreground">
            <Icon name="Users" size={36} className="mx-auto mb-2 opacity-20" fallback="Circle" />
            <p className="text-sm font-medium">Инструктаж ещё никому не назначен</p>
            <button onClick={() => openAssign(progressBriefing!)} className="mt-3 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors">
              Назначить сейчас
            </button>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
              <span className="col-span-2">Сотрудник</span>
              <span>Срок</span>
              <span>Статус</span>
            </div>
            {progressRows.map(r => (
              <div key={r.id} className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border/50 last:border-0 items-center">
                <div className="col-span-2 min-w-0">
                  <p className="text-sm font-medium truncate">{r.fio}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.due_date ? r.due_date.slice(0, 10) : "—"}
                </span>
                <span>
                  {r.completed_at ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      <Icon name="CheckCircle" size={11} fallback="Check" /> Пройдено
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Icon name="Clock" size={11} fallback="Circle" /> Ожидает
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => openAssign(progressBriefing!)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
          <Icon name="Send" size={14} fallback="Circle" /> Назначить ещё сотрудникам
        </button>
      </div>
    );
  }

  // ── РЕДАКТОР ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} fallback="Circle" /> {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => setView("list")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <Icon name="ArrowLeft" size={16} fallback="Circle" />
        </button>
        <h2 className="font-semibold text-base">{editId ? "Редактировать инструктаж" : "Новый инструктаж"}</h2>
      </div>

      {/* Основные параметры */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5">Название *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Например: Вводный инструктаж (редакция 2025)"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Описание</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
            placeholder="Краткое описание инструктажа"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium mb-1.5">Длительность (мин)</label>
          <input type="number" min={5} max={240} value={duration} onChange={e => setDuration(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>

        {/* Импорт из стандартного */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium mb-2">Импортировать блоки из стандартного инструктажа</p>
          <div className="flex flex-wrap gap-2">
            {BRIEFINGS_DATA.map(b =>
              b.variants ? b.variants.map(v => (
                <button key={`${b.id}_${v.id}`} onClick={() => importFromStandard(b.id, v.id)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                  {b.title} · {v.label}
                </button>
              )) : (
                <button key={b.id} onClick={() => importFromStandard(b.id)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                  {b.title}
                </button>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Блоки добавятся к текущему содержимому (дублирование не проверяется)</p>
        </div>
      </div>

      {/* Блоки */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Блоки <span className="text-muted-foreground font-normal">({blocks.length})</span></p>
        </div>

        {blocks.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
            Добавьте блоки или импортируйте из стандартного инструктажа
          </div>
        )}

        {blocks.map((b, i) => (
          <BlockEditor
            key={i}
            block={b}
            onChange={nb => updateBlock(i, nb)}
            onDelete={() => deleteBlock(i)}
            onUp={() => moveBlock(i, -1)}
            onDown={() => moveBlock(i, 1)}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
          />
        ))}

        {/* Добавить блок */}
        <div className="relative">
          <button onClick={() => setAddOpen(o => !o)}
            className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-2">
            <Icon name="Plus" size={15} fallback="Circle" /> Добавить блок
          </button>
          {addOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-10 p-2 grid grid-cols-2 gap-1">
              {(Object.entries(BLOCK_TYPE_LABELS) as [Block["type"], string][]).map(([type, label]) => (
                <button key={type} onClick={() => addBlock(type)}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted text-left transition-colors">
                  <Icon name={BLOCK_ICONS[type] as "FileText"} size={13} className="text-muted-foreground shrink-0" fallback="Circle" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={save} disabled={saving}
          className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? "Сохраняем..." : editId ? "Сохранить изменения" : "Создать инструктаж"}
        </button>
        <button onClick={() => setView("list")} className="px-5 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}
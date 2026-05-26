import { useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { Template } from "@/data/infoData";

const DOCS_URL = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";

function getCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}
function authH() {
  const sid = getCookie("session_id");
  return { "Content-Type": "application/json", ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}) };
}
async function apiFetch(action: string, opts: RequestInit = {}, qs: Record<string, string> = {}) {
  const p = new URLSearchParams({ action, ...qs });
  return fetch(`${DOCS_URL}?${p}`, { ...opts, headers: { ...authH(), ...(opts.headers as Record<string, string> || {}) } });
}

export interface SavedCard {
  card_id: number;
  card_type: "sout" | "profrisk";
  template_id: string;
  title: string;
  filled_values: Record<string, string>;
  assignments?: Array<{ employee_id: number; fio: string; assigned_at: string; read_at: string | null }>;
  file_url?: string | null;
  file_name?: string | null;
}

interface Employee { id: number; fio: string; email: string; }

interface Props {
  template: Template;
  onBack: () => void;
  /** Роль текущего пользователя */
  userRole?: "employer" | "employee";
  /** ID пользователя для привязки localStorage */
  userId?: number;
  /** Если открыта уже сохранённая карта */
  savedCard?: SavedCard;
  /** Заполненные значения от работодателя (режим просмотра сотрудника) */
  readonlyValues?: Record<string, string>;
}

function storageKey(userId?: number) {
  return userId ? `u_${userId}_templateValues` : "templateValues_guest";
}

function loadLocal(templateId: string, userId?: number): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "{}")[templateId] || {};
  } catch { return {}; }
}
function saveLocal(templateId: string, vals: Record<string, string>, userId?: number) {
  try {
    const key = storageKey(userId);
    const all = JSON.parse(localStorage.getItem(key) || "{}");
    all[templateId] = vals;
    localStorage.setItem(key, JSON.stringify(all));
  } catch { /* ignore */ }
}

const FONT_SIZES = ["10", "11", "12", "14", "16", "18", "20", "24", "28", "36"];

export default function TemplateEditor({ template, onBack, userRole, userId, savedCard, readonlyValues }: Props) {
  const isEmployer = userRole === "employer";
  // Сотрудник видит только readonly-карту
  const isReadonly = userRole === "employee" && !!readonlyValues;

  const initValues = readonlyValues || savedCard?.filled_values || loadLocal(template.id, userId);
  const [values, setValues] = useState<Record<string, string>>(initValues);
  const [tab, setTab] = useState<"form" | "editor" | "preview">(
    isReadonly ? "preview" : (template.fields.length > 0 ? "form" : "editor")
  );

  const isCustom = template.fields.length === 0;
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorHtml, setEditorHtml] = useState(() => {
    if (isCustom) {
      return (readonlyValues?.["__html__"] || savedCard?.filled_values?.["__html__"] || loadLocal(template.id, userId)["__html__"] || template.content || "");
    }
    return "";
  });

  const [localSaved, setLocalSaved] = useState(false);
  const [serverSaving, setServerSaving] = useState(false);
  const [serverToast, setServerToast] = useState("");
  const [cardId, setCardId] = useState<number | undefined>(savedCard?.card_id);

  // Отправка сотрудникам
  const [showAssign, setShowAssign] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);

  const toast = (msg: string) => { setServerToast(msg); setTimeout(() => setServerToast(""), 3000); };

  const autosave = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setEditorHtml(html);
    if (!isReadonly) {
      const vals = { ...loadLocal(template.id, userId), "__html__": html };
      saveLocal(template.id, vals, userId);
      setLocalSaved(true);
      setTimeout(() => setLocalSaved(false), 1200);
    }
  }, [template.id, isReadonly, userId]);

  const set = (key: string, val: string) => {
    if (isReadonly) return;
    setValues(prev => {
      const next = { ...prev, [key]: val };
      saveLocal(template.id, next, userId);
      return next;
    });
    setLocalSaved(true);
    setTimeout(() => setLocalSaved(false), 1200);
  };

  const exec = (cmd: string, val?: string) => {
    if (isReadonly) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    setTimeout(autosave, 100);
  };

  const setFontSize = (size: string) => {
    if (isReadonly) return;
    editorRef.current?.focus();
    document.execCommand("fontSize", false, "7");
    const fonts = editorRef.current?.querySelectorAll('font[size="7"]');
    fonts?.forEach(el => {
      (el as HTMLElement).removeAttribute("size");
      (el as HTMLElement).style.fontSize = `${size}pt`;
    });
    setTimeout(autosave, 100);
  };

  // Сохранить карту на сервере (только employer)
  const saveToServer = async () => {
    if (!isEmployer) return;
    setServerSaving(true);
    const filledValues = isCustom
      ? { "__html__": editorRef.current?.innerHTML || editorHtml }
      : { ...values };
    const cardType = template.id.startsWith("profrisk") || template.category?.toLowerCase().includes("риск")
      ? "profrisk" : "sout";
    const res = await apiFetch("card_save", {
      method: "POST",
      body: JSON.stringify({
        card_id: cardId,
        card_type: cardType,
        template_id: template.id,
        title: template.title,
        filled_values: filledValues,
      }),
    });
    setServerSaving(false);
    if (res.ok) {
      const data = await res.json();
      setCardId(data.card_id);
      toast("Карта сохранена");
    } else {
      toast("Ошибка сохранения");
    }
  };

  // Загрузить список сотрудников
  const loadEmployees = async (q = "") => {
    const res = await apiFetch("employees", {}, q ? { q } : {});
    if (res.ok) { const d = await res.json(); setEmployees(d.employees || []); }
  };

  const openAssign = async () => {
    if (!cardId) {
      toast("Сначала сохраните карту");
      return;
    }
    await loadEmployees();
    setShowAssign(true);
  };

  const sendToEmployees = async () => {
    if (!cardId || selectedEmps.length === 0) return;
    setAssigning(true);
    const res = await apiFetch("card_assign", {
      method: "POST",
      body: JSON.stringify({ card_id: cardId, employee_ids: selectedEmps }),
    });
    const data = await res.json();
    setAssigning(false);
    if (res.ok) {
      toast(`Карта отправлена ${data.assigned_to} сотруднику(ам)`);
      setShowAssign(false);
      setSelectedEmps([]);
    } else {
      toast(data.error || "Ошибка отправки");
    }
  };

  const downloadDoc = () => {
    if (isCustom) {
      const content = editorRef.current?.innerHTML || editorHtml;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Times New Roman,serif;margin:40px;font-size:14pt;line-height:1.5;}</style>
</head><body>${content}</body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${template.title}.html`; a.click();
    } else {
      const filled = template.fields.reduce((txt, f) =>
        txt.replaceAll(`{{${f.key}}}`, values[f.key] || "___________"), template.content);
      const blob = new Blob([filled], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${template.title}.txt`; a.click();
    }
  };

  const preview = (() => {
    let result = template.content;
    template.fields.forEach(f => {
      result = result.replaceAll(`{{${f.key}}}`, values[f.key] || `[${f.label}]`);
    });
    return result;
  })();

  const allFilled = isCustom ? true : template.fields.every(f => values[f.key]?.trim());

  const tabs = [
    ...(template.fields.length > 0 && !isReadonly ? [{ id: "form", label: "Заполнить поля", icon: "PenLine" }] : []),
    ...(!isReadonly ? [{ id: "editor", label: "Редактор", icon: "FileEdit" }] : []),
    { id: "preview", label: "Предпросмотр", icon: "Eye" },
  ] as const;

  return (
    <div className="space-y-4 animate-fade-in">
      {serverToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2">
          <Icon name="CheckCircle" size={15} fallback="Circle" /> {serverToast}
        </div>
      )}

      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="ArrowLeft" size={15} fallback="Circle" /> Назад
          </button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h2 className="font-semibold text-sm">{template.title}</h2>
            {isReadonly && <p className="text-xs text-muted-foreground">Просмотр · только чтение</p>}
            {cardId && isEmployer && <p className="text-xs text-green-600">Сохранено на сервере</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {localSaved && !isReadonly && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Icon name="Check" size={12} fallback="Check" /> Сохранено локально
            </span>
          )}
          {/* Кнопки работодателя */}
          {isEmployer && (
            <>
              <button onClick={saveToServer} disabled={serverSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-primary text-primary hover:bg-primary/5 font-medium disabled:opacity-50">
                <Icon name="CloudUpload" size={13} fallback="Circle" />
                {serverSaving ? "Сохраняем..." : cardId ? "Обновить" : "Сохранить карту"}
              </button>
              {cardId && (
                <button onClick={openAssign}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 font-medium">
                  <Icon name="Send" size={13} fallback="Circle" /> Отправить сотруднику
                </button>
              )}
            </>
          )}
          <button onClick={downloadDoc}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${allFilled ? "bg-muted text-foreground hover:bg-muted/80" : "bg-muted text-muted-foreground"}`}>
            <Icon name="Download" size={13} fallback="Circle" /> Скачать
          </button>
        </div>
      </div>

      {/* Табы */}
      {tabs.length > 1 && (
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${tab === t.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon name={t.icon} size={13} fallback="Circle" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Readonly-баннер для сотрудника */}
      {isReadonly && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 items-center">
          <Icon name="Info" size={15} className="text-blue-600 shrink-0" fallback="Circle" />
          <p className="text-sm text-blue-800">Карта направлена вам работодателем для ознакомления. Редактирование недоступно.</p>
        </div>
      )}

      {/* ── ФОРМА ПОЛЕЙ ── */}
      {tab === "form" && template.fields.length > 0 && !isReadonly && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <p className="text-xs text-muted-foreground">Заполните поля — данные сохраняются автоматически</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {template.fields.map(field => (
              <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-medium text-foreground mb-1.5">{field.label}</label>
                {field.type === "text" && (
                  <input type="text" value={values[field.key] || ""} onChange={e => set(field.key, e.target.value)}
                    placeholder={field.placeholder || ""}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                )}
                {field.type === "date" && (
                  <input type="date" onChange={e => {
                    const d = new Date(e.target.value);
                    set(field.key, !isNaN(d.getTime()) ? d.toLocaleDateString("ru-RU") : e.target.value);
                  }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                )}
                {field.type === "select" && field.options && (
                  <select value={values[field.key] || ""} onChange={e => set(field.key, e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white transition-colors">
                    <option value="">— выбрать —</option>
                    {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
                {field.type === "textarea" && (
                  <textarea value={values[field.key] || ""} onChange={e => set(field.key, e.target.value)}
                    placeholder={field.placeholder || ""} rows={3}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={() => setTab("preview")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors font-medium">
              <Icon name="Eye" size={14} fallback="Circle" /> Предпросмотр
            </button>
            <button onClick={() => { setValues({}); saveLocal(template.id, {}, userId); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <Icon name="RotateCcw" size={13} fallback="Circle" /> Очистить
            </button>
          </div>
        </div>
      )}

      {/* ── РЕДАКТОР ── */}
      {tab === "editor" && !isReadonly && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-3 py-2 flex flex-wrap items-center gap-1">
            <select onChange={e => setFontSize(e.target.value)} defaultValue="14"
              className="h-7 text-xs border border-border rounded px-1.5 bg-white focus:outline-none w-16" title="Размер шрифта">
              {FONT_SIZES.map(s => <option key={s} value={s}>{s}pt</option>)}
            </select>
            <div className="w-px h-5 bg-border mx-0.5" />
            {[{cmd:"bold",icon:"Bold"},{cmd:"italic",icon:"Italic"},{cmd:"underline",icon:"Underline"},{cmd:"strikeThrough",icon:"Strikethrough"}].map(b => (
              <button key={b.cmd} onMouseDown={e=>{e.preventDefault();exec(b.cmd);}} title={b.cmd}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-0.5" />
            {[{cmd:"justifyLeft",icon:"AlignLeft"},{cmd:"justifyCenter",icon:"AlignCenter"},{cmd:"justifyRight",icon:"AlignRight"},{cmd:"justifyFull",icon:"AlignJustify"}].map(b => (
              <button key={b.cmd} onMouseDown={e=>{e.preventDefault();exec(b.cmd);}} title={b.cmd}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-0.5" />
            {[{cmd:"insertUnorderedList",icon:"List"},{cmd:"insertOrderedList",icon:"ListOrdered"},{cmd:"indent",icon:"IndentIncrease"},{cmd:"outdent",icon:"IndentDecrease"}].map(b => (
              <button key={b.cmd} onMouseDown={e=>{e.preventDefault();exec(b.cmd);}} title={b.cmd}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-0.5" />
            <button onMouseDown={e=>{e.preventDefault();exec("insertHorizontalRule");}} title="Линия"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
              <Icon name="Minus" size={14} fallback="Circle" />
            </button>
            <label title="Цвет текста" className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted cursor-pointer relative">
              <Icon name="Palette" size={14} fallback="Circle" />
              <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={e=>exec("foreColor",e.target.value)} />
            </label>
            <div className="w-px h-5 bg-border mx-0.5" />
            {[{cmd:"undo",icon:"Undo2"},{cmd:"redo",icon:"Redo2"}].map(b=>(
              <button key={b.cmd} onMouseDown={e=>{e.preventDefault();exec(b.cmd);}} title={b.cmd}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}
            <div className="ml-auto">
              <button onMouseDown={e=>{e.preventDefault();autosave();}}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/5">
                <Icon name="Save" size={12} fallback="Circle" /> Сохранить
              </button>
            </div>
          </div>
          <div ref={editorRef} contentEditable suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: editorHtml }}
            onInput={autosave} onBlur={autosave}
            className="min-h-[400px] p-6 focus:outline-none"
            style={{ fontFamily:"Times New Roman,serif", fontSize:"14pt", lineHeight:"1.6",
              direction:"ltr", unicodeBidi:"plaintext", textAlign:"left", writingMode:"horizontal-tb" }} />
          <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
            Скачивание в формате HTML (открывается в Word)
          </div>
        </div>
      )}

      {/* ── ПРЕДПРОСМОТР ── */}
      {tab === "preview" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground font-medium">Предпросмотр документа</span>
            <button onClick={downloadDoc} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
              <Icon name="Download" size={13} fallback="Circle" /> Скачать
            </button>
          </div>
          {isCustom ? (
            <div className="p-8" style={{ fontFamily:"Times New Roman,serif", fontSize:"14pt", lineHeight:"1.6" }}
              dangerouslySetInnerHTML={{ __html: editorHtml }} />
          ) : (
            <pre className="p-8 text-sm font-serif leading-relaxed whitespace-pre-wrap text-foreground">{preview}</pre>
          )}
        </div>
      )}

      {/* Модалка отправки сотрудникам */}
      {showAssign && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Icon name="Send" size={16} className="text-primary" fallback="Circle" />
              Отправить карту сотруднику
            </h3>
            <p className="text-xs text-muted-foreground">«{template.title}»</p>

            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fallback="Circle" />
              <input value={empSearch} onChange={e => { setEmpSearch(e.target.value); loadEmployees(e.target.value); }}
                placeholder="Поиск по ФИО..."
                className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary" />
            </div>

            <div className="space-y-1 max-h-48 overflow-auto border border-border rounded-xl">
              {employees.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Сотрудников не найдено</p>
              ) : employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors">
                  <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${selectedEmps.includes(emp.id) ? "bg-primary border-primary" : "border-border"}`}
                    onClick={() => setSelectedEmps(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id])}>
                    {selectedEmps.includes(emp.id) && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                  </div>
                  <div className="flex-1" onClick={() => setSelectedEmps(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id])}>
                    <p className="text-sm font-medium">{emp.fio}</p>
                    <p className="text-xs text-muted-foreground">{emp.email}</p>
                  </div>
                </label>
              ))}
            </div>

            {selectedEmps.length > 0 && <p className="text-xs text-primary font-medium">Выбрано: {selectedEmps.length} сотрудника(ов)</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={sendToEmployees} disabled={assigning || selectedEmps.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                {assigning ? "Отправляем..." : `Отправить (${selectedEmps.length})`}
              </button>
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
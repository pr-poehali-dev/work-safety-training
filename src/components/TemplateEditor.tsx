import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { Template } from "@/data/infoData";

interface Props {
  template: Template;
  onBack: () => void;
}

const STORAGE_KEY = "templateValues";

function loadSaved(id: string): Record<string, string> {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all[id] || {};
  } catch { return {}; }
}

function saveTpl(id: string, vals: Record<string, string>) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all[id] = vals;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

const FONT_SIZES = ["10", "11", "12", "14", "16", "18", "20", "24", "28", "36"];

export default function TemplateEditor({ template, onBack }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => loadSaved(template.id));
  const [tab, setTab] = useState<"form" | "editor" | "preview">(
    template.fields.length > 0 ? "form" : "editor"
  );
  const [saved, setSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Для пользовательских шаблонов (fields пустой) — редактируем content напрямую
  const isCustom = template.fields.length === 0;

  // Начальное содержимое редактора
  const [editorKey, setEditorKey] = useState(0);
  const [editorHtml, setEditorHtml] = useState(() => {
    if (isCustom) {
      const saved = loadSaved(template.id);
      return saved["__html__"] || template.content || "";
    }
    return "";
  });

  const autosave = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setEditorHtml(html);
    const vals = { ...loadSaved(template.id), "__html__": html };
    saveTpl(template.id, vals);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }, [template.id]);

  // Preview для шаблона с полями
  const preview = (() => {
    let result = template.content;
    template.fields.forEach(f => {
      const val = values[f.key] || `[${f.label}]`;
      result = result.replaceAll(`{{${f.key}}}`, val);
    });
    return result;
  })();

  const set = (key: string, val: string) => {
    setValues(prev => {
      const next = { ...prev, [key]: val };
      saveTpl(template.id, next);
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  // Форматирование текста
  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    setTimeout(autosave, 100);
  };

  const setFontSize = (size: string) => {
    editorRef.current?.focus();
    // execCommand fontSize принимает 1-7, используем hack через font tag
    document.execCommand("fontSize", false, "7");
    const fonts = editorRef.current?.querySelectorAll('font[size="7"]');
    fonts?.forEach(el => {
      (el as HTMLElement).removeAttribute("size");
      (el as HTMLElement).style.fontSize = `${size}pt`;
    });
    setTimeout(autosave, 100);
  };

  const downloadDoc = () => {
    if (isCustom) {
      // Скачиваем HTML как файл
      const content = editorRef.current?.innerHTML || editorHtml;
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:Times New Roman,serif;margin:40px;font-size:14pt;line-height:1.5;}</style>
</head><body>${content}</body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${template.title}.html`;
      a.click();
    } else {
      const filled = template.fields.reduce((txt, f) => {
        return txt.replaceAll(`{{${f.key}}}`, values[f.key] || "___________");
      }, template.content);
      const blob = new Blob([filled], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${template.title}.txt`;
      a.click();
    }
  };

  const allFilled = isCustom ? true : template.fields.every(f => values[f.key]?.trim());

  const tabs = [
    ...(template.fields.length > 0 ? [{ id: "form", label: "Заполнить поля", icon: "PenLine" }] : []),
    { id: "editor", label: "Редактор", icon: "FileEdit" },
    { id: "preview", label: "Предпросмотр", icon: "Eye" },
  ] as const;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeft" size={15} fallback="Circle" />
            Назад
          </button>
          <div className="h-4 w-px bg-border" />
          <h2 className="font-semibold text-sm truncate max-w-xs">{template.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1 animate-fade-in">
              <Icon name="Check" size={12} fallback="Check" /> Сохранено
            </span>
          )}
          <button
            onClick={downloadDoc}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              allFilled ? "bg-primary text-white hover:bg-primary/90" : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon name="Download" size={13} fallback="Circle" />
            Скачать
          </button>
        </div>
      </div>

      {/* Переключатель вкладок */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
              tab === t.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name={t.icon} size={13} fallback="Circle" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ФОРМА ПОЛЕЙ ── */}
      {tab === "form" && template.fields.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <p className="text-xs text-muted-foreground">Заполните поля — данные сохраняются автоматически</p>

          <div className="grid sm:grid-cols-2 gap-4">
            {template.fields.map(field => (
              <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {field.label}
                </label>

                {field.type === "text" && (
                  <input
                    type="text"
                    value={values[field.key] || ""}
                    onChange={e => set(field.key, e.target.value)}
                    placeholder={field.placeholder || ""}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                )}

                {field.type === "date" && (
                  <input
                    type="date"
                    onChange={e => {
                      const d = new Date(e.target.value);
                      const formatted = !isNaN(d.getTime())
                        ? d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : e.target.value;
                      set(field.key, formatted);
                    }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                )}

                {field.type === "select" && field.options && (
                  <select
                    value={values[field.key] || ""}
                    onChange={e => set(field.key, e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white transition-colors"
                  >
                    <option value="">— выбрать —</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === "textarea" && (
                  <textarea
                    value={values[field.key] || ""}
                    onChange={e => set(field.key, e.target.value)}
                    placeholder={field.placeholder || ""}
                    rows={3}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <button
              onClick={() => setTab("editor")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors font-medium"
            >
              <Icon name="FileEdit" size={14} fallback="Circle" />
              Открыть редактор
            </button>
            <button
              onClick={() => { setValues({}); saveTpl(template.id, {}); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <Icon name="RotateCcw" size={13} fallback="Circle" />
              Очистить
            </button>
            {!allFilled && (
              <span className="text-xs text-muted-foreground">Заполните все поля для скачивания</span>
            )}
          </div>
        </div>
      )}

      {/* ── РЕДАКТОР ── */}
      {tab === "editor" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {/* Тулбар */}
          <div className="border-b border-border bg-muted/40 px-3 py-2 flex flex-wrap items-center gap-1">

            {/* Размер шрифта */}
            <select
              onChange={e => setFontSize(e.target.value)}
              defaultValue="14"
              className="h-7 text-xs border border-border rounded px-1.5 bg-white focus:outline-none focus:border-primary w-16"
              title="Размер шрифта"
            >
              {FONT_SIZES.map(s => (
                <option key={s} value={s}>{s}pt</option>
              ))}
            </select>

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Жирный, курсив, подчёркнутый, зачёркнутый */}
            {[
              { cmd: "bold", icon: "Bold", title: "Жирный (Ctrl+B)" },
              { cmd: "italic", icon: "Italic", title: "Курсив (Ctrl+I)" },
              { cmd: "underline", icon: "Underline", title: "Подчёркнутый (Ctrl+U)" },
              { cmd: "strikeThrough", icon: "Strikethrough", title: "Зачёркнутый" },
            ].map(b => (
              <button
                key={b.cmd}
                onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                title={b.title}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground"
              >
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Выравнивание */}
            {[
              { cmd: "justifyLeft", icon: "AlignLeft", title: "По левому краю" },
              { cmd: "justifyCenter", icon: "AlignCenter", title: "По центру" },
              { cmd: "justifyRight", icon: "AlignRight", title: "По правому краю" },
              { cmd: "justifyFull", icon: "AlignJustify", title: "По ширине" },
            ].map(b => (
              <button
                key={b.cmd}
                onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                title={b.title}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground"
              >
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Списки */}
            {[
              { cmd: "insertUnorderedList", icon: "List", title: "Маркированный список" },
              { cmd: "insertOrderedList", icon: "ListOrdered", title: "Нумерованный список" },
            ].map(b => (
              <button
                key={b.cmd}
                onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                title={b.title}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground"
              >
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Отступы */}
            {[
              { cmd: "indent", icon: "IndentIncrease", title: "Увеличить отступ" },
              { cmd: "outdent", icon: "IndentDecrease", title: "Уменьшить отступ" },
            ].map(b => (
              <button
                key={b.cmd}
                onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                title={b.title}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground"
              >
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Горизонтальная линия */}
            <button
              onMouseDown={e => { e.preventDefault(); exec("insertHorizontalRule"); }}
              title="Горизонтальная линия"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground"
            >
              <Icon name="Minus" size={14} fallback="Circle" />
            </button>

            {/* Цвет текста */}
            <label title="Цвет текста" className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors cursor-pointer relative">
              <Icon name="Palette" size={14} fallback="Circle" />
              <input
                type="color"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={e => exec("foreColor", e.target.value)}
              />
            </label>

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Отмена / повтор */}
            {[
              { cmd: "undo", icon: "Undo2", title: "Отменить (Ctrl+Z)" },
              { cmd: "redo", icon: "Redo2", title: "Повторить (Ctrl+Y)" },
            ].map(b => (
              <button
                key={b.cmd}
                onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                title={b.title}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <Icon name={b.icon} size={14} fallback="Circle" />
              </button>
            ))}

            <div className="ml-auto">
              <button
                onMouseDown={e => { e.preventDefault(); autosave(); }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <Icon name="Save" size={12} fallback="Circle" />
                Сохранить
              </button>
            </div>
          </div>

          {/* Область редактирования */}
          <div
            ref={editorRef}
            key={editorKey}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: editorHtml }}
            onInput={autosave}
            onBlur={autosave}
            className="min-h-[400px] p-6 text-sm leading-relaxed focus:outline-none"
            style={{
              fontFamily: "Times New Roman, serif",
              fontSize: "14pt",
              lineHeight: "1.6",
            }}
          />

          <div className="border-t border-border bg-muted/20 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Нажмите Ctrl+S или кнопку «Сохранить» для сохранения</span>
            <span>Скачивание в формате HTML (открывается в Word)</span>
          </div>
        </div>
      )}

      {/* ── ПРЕДПРОСМОТР ── */}
      {tab === "preview" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground font-medium">Предпросмотр документа</span>
            <button
              onClick={downloadDoc}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              <Icon name="Download" size={13} fallback="Circle" />
              Скачать
            </button>
          </div>
          {isCustom ? (
            <div
              className="p-8"
              style={{ fontFamily: "Times New Roman, serif", fontSize: "14pt", lineHeight: "1.6" }}
              dangerouslySetInnerHTML={{ __html: editorHtml }}
            />
          ) : (
            <pre className="p-8 text-sm font-serif leading-relaxed whitespace-pre-wrap text-foreground">
              {preview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
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

export default function TemplateEditor({ template, onBack }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => loadSaved(template.id));
  const [preview, setPreview] = useState(template.content);
  const [tab, setTab] = useState<"form" | "preview">("form");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let result = template.content;
    template.fields.forEach(f => {
      const val = values[f.key] || `[${f.label}]`;
      result = result.replaceAll(`{{${f.key}}}`, val);
    });
    setPreview(result);
  }, [values, template]);

  const set = (key: string, val: string) => {
    setValues(prev => {
      const next = { ...prev, [key]: val };
      saveTpl(template.id, next);
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const download = () => {
    const filled = template.fields.reduce((txt, f) => {
      return txt.replaceAll(`{{${f.key}}}`, values[f.key] || "___________");
    }, template.content);
    const blob = new Blob([filled], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${template.title}.txt`;
    a.click();
  };

  const allFilled = template.fields.every(f => values[f.key]?.trim());

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Шапка */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="ArrowLeft" size={15} fallback="Circle" />
          Назад
        </button>
        <div className="h-4 w-px bg-border" />
        <h2 className="font-semibold text-sm truncate">{template.title}</h2>
      </div>

      {/* Переключатель вкладок */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("form")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
            tab === "form" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Заполнить поля
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
            tab === "preview" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Предпросмотр
        </button>
      </div>

      {/* Форма */}
      {tab === "form" && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Заполните поля — данные сохраняются автоматически</p>
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1 animate-fade-in">
              <Icon name="Check" size={12} fallback="Check" /> Сохранено
            </span>
          )}
        </div>

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
                    value={values[field.key] || ""}
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

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              onClick={() => setTab("preview")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors font-medium"
            >
              <Icon name="Eye" size={14} fallback="Circle" />
              Предпросмотр
            </button>
            <button
              onClick={() => { setValues({}); saveTpl(template.id, {}); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <Icon name="RotateCcw" size={13} fallback="Circle" />
              Очистить
            </button>
            <button
              onClick={download}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                allFilled
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <Icon name="Download" size={14} fallback="Circle" />
              Скачать документ (.txt)
            </button>
            {!allFilled && (
              <span className="text-xs text-muted-foreground">Заполните все поля для скачивания</span>
            )}
          </div>
        </div>
      )}

      {/* Предпросмотр */}
      {tab === "preview" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground font-medium">Предпросмотр документа</span>
            <button
              onClick={download}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Icon name="Download" size={12} fallback="Circle" />
              Скачать
            </button>
          </div>
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap p-5 max-h-[65vh] overflow-auto text-foreground">
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}
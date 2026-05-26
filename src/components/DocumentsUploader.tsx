import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { apiDocs, type CompanyDoc } from "@/lib/docsApi";

interface Employee { id: number; fio: string; email: string; }

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
  return fetch(`${DOCS_URL}?${p}`, { ...opts, headers: { ...authH(), ...(opts.headers as Record<string,string> || {}) } });
}

export default function DocumentsUploader() {
  const [docs, setDocs] = useState<CompanyDoc[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"list" | "upload" | "assign">("list");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");

  // Upload form
  const [docType, setDocType] = useState<"sout" | "profrisk">("sout");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Assign form
  const [assignDocId, setAssignDocId] = useState<number | null>(null);
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadDocs = useCallback(async () => {
    const res = await apiFetch("list");
    if (res.ok) { const d = await res.json(); setDocs(d.documents || []); }
  }, []);

  const loadEmployees = useCallback(async (q = "") => {
    const res = await apiFetch("employees", {}, q ? { q } : {});
    if (res.ok) { const d = await res.json(); setEmployees(d.employees || []); }
  }, []);

  useEffect(() => { loadDocs(); loadEmployees(); }, [loadDocs, loadEmployees]);

  useEffect(() => {
    const t = setTimeout(() => loadEmployees(search), 300);
    return () => clearTimeout(t);
  }, [search, loadEmployees]);

  const upload = async () => {
    if (!file || !title) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const b64 = (e.target?.result as string).split(",")[1];
        const res = await apiFetch("upload", {
          method: "POST",
          body: JSON.stringify({ doc_type: docType, title, file_b64: b64, file_name: file.name }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast("Документ загружен");
          setTitle(""); setFile(null); setTab("list");
          loadDocs();
        } else {
          showToast(data.error || "Ошибка загрузки");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      showToast("Ошибка загрузки файла");
      setUploading(false);
    }
  };

  const assign = async () => {
    if (!assignDocId || selectedEmps.length === 0) return;
    setUploading(true);
    const res = await apiFetch("assign", {
      method: "POST",
      body: JSON.stringify({ document_id: assignDocId, employee_ids: selectedEmps }),
    });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      showToast(`Документ отправлен ${data.assigned_to} сотруднику(ам)`);
      setAssignDocId(null); setSelectedEmps([]); setTab("list");
      loadDocs();
    } else {
      showToast(data.error || "Ошибка");
    }
  };

  const deleteDoc = async (id: number) => {
    if (!confirm("Удалить документ? Это действие нельзя отменить.")) return;
    const res = await apiFetch("delete", { method: "POST", body: JSON.stringify({ document_id: id }) });
    if (res.ok) { showToast("Документ удалён"); loadDocs(); }
  };

  const toggleEmp = (id: number) =>
    setSelectedEmps(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const soutDocs = docs.filter(d => d.doc_type === "sout");
  const profriskDocs = docs.filter(d => d.doc_type === "profrisk");

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={16} fallback="Circle" /> {toast}
        </div>
      )}

      {/* Вкладки */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { id: "list", label: "Мои документы", icon: "Files" },
          { id: "upload", label: "Загрузить", icon: "Upload" },
          { id: "assign", label: "Отправить сотруднику", icon: "Send" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon name={t.icon} size={14} fallback="Circle" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Список документов */}
      {tab === "list" && (
        <div className="space-y-5">
          {docs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Icon name="FileX" size={36} className="mx-auto mb-3 opacity-25" fallback="Circle" />
              <p className="text-sm">Документов ещё нет. Загрузите карту СОУТ или ПрофРисков.</p>
            </div>
          )}

          {soutDocs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-2">Карты СОУТ</p>
              <div className="space-y-2">
                {soutDocs.map(doc => <DocCard key={doc.id} doc={doc} onAssign={(id) => { setAssignDocId(id); setTab("assign"); }} onDelete={deleteDoc} />)}
              </div>
            </div>
          )}

          {profriskDocs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">Карты ПрофРисков</p>
              <div className="space-y-2">
                {profriskDocs.map(doc => <DocCard key={doc.id} doc={doc} onAssign={(id) => { setAssignDocId(id); setTab("assign"); }} onDelete={deleteDoc} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Загрузка */}
      {tab === "upload" && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 max-w-lg">
          <p className="text-sm text-muted-foreground">Загрузите PDF, DOC или DOCX — до 10 МБ</p>

          <div>
            <label className="block text-xs font-medium mb-1.5">Тип документа *</label>
            <div className="grid grid-cols-2 gap-2">
              {([["sout", "Карта СОУТ", "ClipboardList", "green"], ["profrisk", "Карта ПрофРисков", "AlertOctagon", "amber"]] as const).map(([val, label, icon, color]) => (
                <button key={val} type="button" onClick={() => setDocType(val)}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-2 ${
                    docType === val
                      ? color === "green" ? "border-green-500 bg-green-50 text-green-700" : "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  <Icon name={icon} size={15} fallback="Circle" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Название документа *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Карта СОУТ — Электромонтёр, 2025"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Файл *</label>
            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt"
                onChange={e => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <>
                  <Icon name="FileCheck" size={28} className="text-primary mb-2" fallback="Circle" />
                  <p className="text-sm font-medium text-primary">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} МБ</p>
                </>
              ) : (
                <>
                  <Icon name="Upload" size={28} className="text-muted-foreground mb-2" fallback="Circle" />
                  <p className="text-sm text-muted-foreground">Нажмите или перетащите файл</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, TXT · до 10 МБ</p>
                </>
              )}
            </label>
          </div>

          <button onClick={upload} disabled={uploading || !file || !title}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Icon name="Upload" size={14} fallback="Circle" />
            {uploading ? "Загружаем..." : "Загрузить документ"}
          </button>
        </div>
      )}

      {/* Отправка сотруднику */}
      {tab === "assign" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Документ для отправки *</label>
            <select value={assignDocId || ""} onChange={e => setAssignDocId(Number(e.target.value) || null)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
              <option value="">— выберите документ —</option>
              {docs.map(d => (
                <option key={d.id} value={d.id}>
                  [{d.doc_type === "sout" ? "СОУТ" : "ПрофРиск"}] {d.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Поиск сотрудника по ФИО</label>
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fallback="Circle" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Введите ФИО..."
                className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-auto border border-border rounded-xl">
            {employees.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Сотрудников не найдено</div>
            ) : employees.map(emp => (
              <label key={emp.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors">
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  selectedEmps.includes(emp.id) ? "bg-primary border-primary" : "border-border"
                }`} onClick={() => toggleEmp(emp.id)}>
                  {selectedEmps.includes(emp.id) && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                </div>
                <div className="flex-1" onClick={() => toggleEmp(emp.id)}>
                  <p className="text-sm font-medium">{emp.fio}</p>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                </div>
              </label>
            ))}
          </div>

          {selectedEmps.length > 0 && (
            <p className="text-xs text-primary font-medium">Выбрано: {selectedEmps.length} сотрудника(ов)</p>
          )}

          <button onClick={assign} disabled={uploading || !assignDocId || selectedEmps.length === 0}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Icon name="Send" size={14} fallback="Circle" />
            {uploading ? "Отправляем..." : `Отправить выбранным (${selectedEmps.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

function DocCard({ doc, onAssign, onDelete }: {
  doc: CompanyDoc;
  onAssign: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const isSout = doc.doc_type === "sout";
  const sentTo = doc.assignments?.length || 0;
  const readBy = doc.assignments?.filter(a => a.read_at).length || 0;

  return (
    <div className={`rounded-xl border p-4 ${isSout ? "bg-green-50/60 border-green-200" : "bg-amber-50/60 border-amber-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSout ? "bg-green-100" : "bg-amber-100"}`}>
          <Icon name={isSout ? "ClipboardList" : "AlertOctagon"} size={18} className={isSout ? "text-green-700" : "text-amber-700"} fallback="Circle" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{doc.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{doc.file_name}</p>
          {sentTo > 0 && (
            <p className="text-xs mt-1 text-muted-foreground">
              Отправлено: {sentTo} · Ознакомились: {readBy}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg border border-border bg-white hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="ExternalLink" size={14} fallback="Circle" />
          </a>
          <button onClick={() => onAssign(doc.id)}
            className="p-1.5 rounded-lg border border-primary/30 bg-white hover:bg-primary/5 transition-colors text-primary">
            <Icon name="Send" size={14} fallback="Circle" />
          </button>
          <button onClick={() => onDelete(doc.id)}
            className="p-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 transition-colors text-red-500">
            <Icon name="Trash2" size={14} fallback="Circle" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { TESTS_DATA } from "@/data/tests";

interface Employee {
  id: number;
  fio: string;
  email: string;
  phone: string | null;
  tests: Array<{
    id: number; test_id: string; test_title: string;
    assigned_at: string; due_date: string | null;
    completed_at: string | null; score: number | null;
  }>;
}

export default function EmployerPanel() {
  const { user, EMPLOYER_URL } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"employees" | "assign" | "notify">("employees");
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
  const [selectedTest, setSelectedTest] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  function getCookie(name: string) {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  const apiFetch = useCallback((path: string, opts: RequestInit = {}) => {
    const sid = getCookie("session_id");
    return fetch(`${EMPLOYER_URL}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", Cookie: `session_id=${sid}`, ...(opts.headers || {}) },
    });
  }, [EMPLOYER_URL]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("/employees");
    if (res.ok) {
      const data = await res.json();
      setEmployees(data.employees || []);
    }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const assignTest = async () => {
    if (!selectedEmp || !selectedTest) return;
    setSending(true);
    const testData = TESTS_DATA.find(t => t.id === selectedTest);
    const res = await apiFetch("/assign", {
      method: "POST",
      body: JSON.stringify({ employee_id: selectedEmp, test_id: selectedTest, test_title: testData?.title || selectedTest, due_date: dueDate || null }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      showToast(data.message || "Тест назначен и уведомление отправлено на email");
      setSelectedTest(""); setDueDate(""); setSelectedEmp(null);
      loadEmployees();
    } else {
      showToast(data.error || "Ошибка назначения");
    }
  };

  const sendNotification = async () => {
    if (!selectedEmp || !notifBody) return;
    setSending(true);
    const res = await apiFetch("/notify", {
      method: "POST",
      body: JSON.stringify({ employee_id: selectedEmp, title: notifTitle || "Уведомление", message: notifBody }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      showToast("Уведомление отправлено");
      setNotifTitle(""); setNotifBody(""); setSelectedEmp(null);
    } else {
      showToast(data.error || "Ошибка отправки");
    }
  };

  if (!user || user.role !== "employer") return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Панель работодателя</p>
        <h1 className="text-2xl font-semibold">Управление сотрудниками</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{user.company_name} · {employees.length} сотрудников</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={16} fallback="Circle" />
          {toast}
        </div>
      )}

      {/* Вкладки */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { id: "employees", label: "Сотрудники", icon: "Users" },
          { id: "assign", label: "Назначить тест", icon: "ClipboardCheck" },
          { id: "notify", label: "Уведомление", icon: "Bell" },
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

      {/* Сотрудники */}
      {tab === "employees" && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="Users" size={40} className="mx-auto mb-3 opacity-25" fallback="Circle" />
              <p className="text-sm font-medium">Сотрудников пока нет</p>
              <p className="text-xs mt-1">Попросите сотрудников зарегистрироваться, выбрав вашу компанию</p>
            </div>
          ) : (
            employees.map(emp => {
              const done = emp.tests.filter(t => t.completed_at).length;
              const total = emp.tests.length;
              return (
                <div key={emp.id} className="bg-white border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {emp.fio.split(" ").map(w => w[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp.fio}</p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{done}/{total} тестов</p>
                      <p className="text-xs text-muted-foreground">выполнено</p>
                    </div>
                  </div>
                  {emp.tests.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                      {emp.tests.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate">{t.test_title}</span>
                          {t.completed_at ? (
                            <span className={`font-medium ml-2 shrink-0 ${(t.score || 0) >= 80 ? "text-green-600" : "text-red-500"}`}>
                              {t.score}%
                            </span>
                          ) : (
                            <span className="text-amber-600 ml-2 shrink-0">Ожидает</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Назначить тест */}
      {tab === "assign" && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm text-muted-foreground">Выберите сотрудника и тест. Сотрудник получит уведомление в приложении и письмо на email.</p>

          <div>
            <label className="block text-xs font-medium mb-1.5">Сотрудник *</label>
            <select value={selectedEmp || ""} onChange={e => setSelectedEmp(Number(e.target.value) || null)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
              <option value="">— выберите сотрудника —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fio} ({e.email})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Тест *</label>
            <select value={selectedTest} onChange={e => setSelectedTest(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
              <option value="">— выберите тест —</option>
              {TESTS_DATA.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Срок прохождения <span className="text-muted-foreground font-normal">(по желанию)</span></label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>

          <button onClick={assignTest} disabled={sending || !selectedEmp || !selectedTest}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Icon name="Send" size={14} fallback="Circle" />
            {sending ? "Назначаем..." : "Назначить тест и отправить уведомление"}
          </button>
        </div>
      )}

      {/* Уведомление */}
      {tab === "notify" && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm text-muted-foreground">Отправьте произвольное уведомление сотруднику — в приложение и на email.</p>

          <div>
            <label className="block text-xs font-medium mb-1.5">Сотрудник *</label>
            <select value={selectedEmp || ""} onChange={e => setSelectedEmp(Number(e.target.value) || null)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
              <option value="">— выберите сотрудника —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fio}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Заголовок</label>
            <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)}
              placeholder="Важное уведомление"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Текст сообщения *</label>
            <textarea value={notifBody} onChange={e => setNotifBody(e.target.value)}
              placeholder="Текст уведомления..." rows={4}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>

          <button onClick={sendNotification} disabled={sending || !selectedEmp || !notifBody}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Icon name="Bell" size={14} fallback="Circle" />
            {sending ? "Отправляем..." : "Отправить уведомление"}
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

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

export interface CustomTest {
  id: number;
  title: string;
  description: string;
  passing_score: number;
  time_limit: number;
  question_count: number;
  created_at: string;
}

export interface CustomTestFull extends Omit<CustomTest, "question_count"> {
  questions: CustomQuestion[];
}

export interface CustomQuestion {
  id?: number;
  text: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface Employee { id: number; fio: string; email: string; }

function emptyQuestion(): CustomQuestion {
  return { text: "", options: ["", "", "", ""], correct: 0, explanation: "" };
}

interface Props {
  onBack: () => void;
}

type View = "list" | "editor" | "assign";

export default function CustomTestBuilder({ onBack }: Props) {
  const [view, setView] = useState<View>("list");
  const [tests, setTests] = useState<CustomTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Редактор
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState(80);
  const [timeLimit, setTimeLimit] = useState(20);
  const [questions, setQuestions] = useState<CustomQuestion[]>([emptyQuestion()]);

  // Отправка
  const [assignTestId, setAssignTestId] = useState<number | null>(null);
  const [assignTestTitle, setAssignTestTitle] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [empSearch, setEmpSearch] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadTests = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("custom_test_list");
    if (res.ok) { const d = await res.json(); setTests((d.tests || []).filter((t: CustomTest) => !t.title.startsWith("[УДАЛЁН]"))); }
    setLoading(false);
  }, []);

  useEffect(() => { loadTests(); }, [loadTests]);

  const openNew = () => {
    setEditId(null);
    setTitle(""); setDescription(""); setPassingScore(80); setTimeLimit(20);
    setQuestions([emptyQuestion()]);
    setView("editor");
  };

  const openEdit = async (t: CustomTest) => {
    const res = await apiFetch("custom_test_get", {}, { id: String(t.id) });
    if (!res.ok) { showToast("Ошибка загрузки"); return; }
    const d = await res.json();
    const test: CustomTestFull = d.test;
    setEditId(test.id);
    setTitle(test.title); setDescription(test.description);
    setPassingScore(test.passing_score); setTimeLimit(test.time_limit);
    setQuestions(test.questions.length > 0 ? test.questions : [emptyQuestion()]);
    setView("editor");
  };

  const deleteTest = async (t: CustomTest) => {
    if (!confirm(`Удалить тест «${t.title}»?`)) return;
    const res = await apiFetch("custom_test_delete", { method: "POST", body: JSON.stringify({ id: t.id }) });
    if (res.ok) { showToast("Тест удалён"); loadTests(); }
    else showToast("Ошибка удаления");
  };

  const saveTest = async () => {
    if (!title.trim()) { showToast("Введите название теста"); return; }
    const validQ = questions.filter(q => q.text.trim() && q.options.filter(o => o.trim()).length >= 2);
    if (validQ.length === 0) { showToast("Добавьте хотя бы один вопрос с 2+ вариантами"); return; }
    setSaving(true);
    const res = await apiFetch("custom_test_save", {
      method: "POST",
      body: JSON.stringify({ id: editId, title, description, passing_score: passingScore, time_limit: timeLimit, questions: validQ }),
    });
    setSaving(false);
    if (res.ok) {
      showToast(editId ? "Тест сохранён" : "Тест создан");
      setView("list");
      loadTests();
    } else {
      const d = await res.json();
      showToast(d.error || "Ошибка сохранения");
    }
  };

  const openAssign = async (t: CustomTest) => {
    setAssignTestId(t.id);
    setAssignTestTitle(t.title);
    setSelectedEmps([]); setDueDate(""); setEmpSearch("");
    const res = await apiFetch("employees");
    if (res.ok) { const d = await res.json(); setEmployees(d.employees || []); }
    setView("assign");
  };

  const sendAssign = async () => {
    if (!assignTestId || selectedEmps.length === 0) return;
    setAssigning(true);
    const res = await apiFetch("custom_test_assign", {
      method: "POST",
      body: JSON.stringify({ test_id: assignTestId, employee_ids: selectedEmps, due_date: dueDate || null }),
    });
    const d = await res.json();
    setAssigning(false);
    if (res.ok) {
      showToast(`Тест отправлен ${d.assigned} сотруднику(ам)`);
      setView("list");
    } else showToast(d.error || "Ошибка отправки");
  };

  // ── Вопрос helpers ──
  const setQ = (i: number, patch: Partial<CustomQuestion>) =>
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q));

  const setOption = (qi: number, oi: number, val: string) =>
    setQ(qi, { options: questions[qi].options.map((o, idx) => idx === oi ? val : o) });

  const addOption = (qi: number) => {
    if (questions[qi].options.length >= 6) return;
    setQ(qi, { options: [...questions[qi].options, ""] });
  };

  const removeOption = (qi: number, oi: number) => {
    const opts = questions[qi].options.filter((_, idx) => idx !== oi);
    const correct = Math.min(questions[qi].correct, opts.length - 1);
    setQ(qi, { options: opts, correct });
  };

  const filteredEmps = employees.filter(e =>
    !empSearch || e.fio.toLowerCase().includes(empSearch.toLowerCase()) || e.email.toLowerCase().includes(empSearch.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={15} fallback="Circle" /> {toast}
        </div>
      )}

      {/* ── СПИСОК ТЕСТОВ ── */}
      {view === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Мои тесты</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Создавайте тесты и назначайте их сотрудникам</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
                <Icon name="ArrowLeft" size={14} fallback="Circle" /> К стандартным
              </button>
              <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
                <Icon name="Plus" size={14} fallback="Circle" /> Создать тест
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
          ) : tests.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-xl text-muted-foreground">
              <Icon name="ClipboardList" size={40} className="mx-auto mb-3 opacity-20" fallback="Circle" />
              <p className="font-medium text-sm">Тестов пока нет</p>
              <p className="text-xs mt-1 mb-4">Создайте первый тест для своих сотрудников</p>
              <button onClick={openNew} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors">
                Создать тест
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map(t => (
                <div key={t.id} className="bg-white border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Icon name="HelpCircle" size={11} fallback="Circle" />{t.question_count} вопросов</span>
                        <span className="flex items-center gap-1"><Icon name="Clock" size={11} fallback="Circle" />{t.time_limit} мин</span>
                        <span className="flex items-center gap-1"><Icon name="Target" size={11} fallback="Circle" />Порог: {t.passing_score}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => openAssign(t)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 font-medium transition-colors">
                        <Icon name="Send" size={12} fallback="Circle" /> Назначить
                      </button>
                      <button onClick={() => openEdit(t)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                        <Icon name="Pencil" size={12} fallback="Circle" /> Редактировать
                      </button>
                      <button onClick={() => deleteTest(t)}
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
      )}

      {/* ── РЕДАКТОР ТЕСТА ── */}
      {view === "editor" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <Icon name="ArrowLeft" size={16} fallback="Circle" />
            </button>
            <h2 className="font-semibold text-base">{editId ? "Редактировать тест" : "Новый тест"}</h2>
          </div>

          {/* Основные параметры */}
          <div className="bg-white border border-border rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Название теста *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Пожарная безопасность цеха №3"
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Описание</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Краткое описание темы теста"
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Проходной балл (%)</label>
                <input type="number" min={50} max={100} value={passingScore} onChange={e => setPassingScore(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Время (минут)</label>
                <input type="number" min={5} max={120} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>
          </div>

          {/* Вопросы */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Вопросы <span className="text-muted-foreground font-normal">({questions.length})</span></p>
              <button onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-primary/40 text-primary hover:bg-primary/5 transition-colors">
                <Icon name="Plus" size={13} fallback="Circle" /> Добавить вопрос
              </button>
            </div>

            {questions.map((q, qi) => (
              <div key={qi} className="bg-white border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{qi + 1}</span>
                  <textarea value={q.text} onChange={e => setQ(qi, { text: e.target.value })} rows={2}
                    placeholder="Текст вопроса..."
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
                  {questions.length > 1 && (
                    <button onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0">
                      <Icon name="X" size={14} fallback="X" />
                    </button>
                  )}
                </div>

                <div className="pl-8 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Варианты ответов <span className="text-primary">(отметьте правильный)</span></p>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button onClick={() => setQ(qi, { correct: oi })}
                        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${q.correct === oi ? "border-primary bg-primary" : "border-border hover:border-primary/50"}`}>
                        {q.correct === oi && <Icon name="Check" size={10} className="text-white" fallback="Check" />}
                      </button>
                      <input value={opt} onChange={e => setOption(qi, oi, e.target.value)}
                        placeholder={`Вариант ${oi + 1}`}
                        className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                      {q.options.length > 2 && (
                        <button onClick={() => removeOption(qi, oi)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Icon name="Minus" size={13} fallback="Minus" />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 6 && (
                    <button onClick={() => addOption(qi)}
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Icon name="Plus" size={11} fallback="Circle" /> Добавить вариант
                    </button>
                  )}
                </div>

                <div className="pl-8">
                  <input value={q.explanation} onChange={e => setQ(qi, { explanation: e.target.value })}
                    placeholder="Пояснение к правильному ответу (необязательно)"
                    className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors text-muted-foreground" />
                </div>
              </div>
            ))}

            <button onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
              className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Icon name="Plus" size={15} fallback="Circle" /> Добавить вопрос
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={saveTest} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Сохраняем..." : editId ? "Сохранить изменения" : "Создать тест"}
            </button>
            <button onClick={() => setView("list")} className="px-5 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* ── НАЗНАЧИТЬ ТЕСТ ── */}
      {view === "assign" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <Icon name="ArrowLeft" size={16} fallback="Circle" />
            </button>
            <div>
              <h2 className="font-semibold text-base">Назначить тест</h2>
              <p className="text-xs text-muted-foreground">«{assignTestTitle}»</p>
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
                  placeholder="Поиск по ФИО..."
                  className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {filteredEmps.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Сотрудников не найдено</p>
                ) : filteredEmps.map(emp => {
                  const sel = selectedEmps.includes(emp.id);
                  return (
                    <button key={emp.id} onClick={() => setSelectedEmps(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id])}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0 ${sel ? "bg-primary/5" : ""}`}>
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
                  <Icon name="Users" size={12} fallback="Circle" /> Выбрано: {selectedEmps.length} сотрудника(ов)
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
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type RegisterData } from "@/contexts/AuthContext";

const AUTH_URL = "https://functions.poehali.dev/392fdf32-3b9a-4824-a62c-d8e2ece4e885";

interface Props {
  onClose: () => void;
  initialMode?: "login" | "register" | "forgot" | "reset";
  resetToken?: string;
}

type Mode = "login" | "register" | "forgot" | "reset";

export default function AuthModal({ onClose, initialMode = "login", resetToken }: Props) {
  const { login, register, getCompanies } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<"employee" | "employer">("employee");
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    fio: "", email: "", password: "", phone: "",
    company_name: "", company_id: "", newPassword: "", newPassword2: "",
  });

  useEffect(() => {
    getCompanies().then(setCompanies);
  }, []);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const switchMode = (m: Mode) => { setMode(m); setError(""); setSuccess(""); };

  // Шаг 1 — запросить ссылку сброса
  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=forgot_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      if (res.ok) {
        setSuccess("Письмо отправлено! Проверьте почту и перейдите по ссылке.");
      } else {
        const d = await res.json();
        setError(d.error || "Ошибка отправки");
      }
    } finally {
      setLoading(false);
    }
  };

  // Шаг 2 — установить новый пароль
  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.newPassword2) { setError("Пароли не совпадают"); return; }
    if (form.newPassword.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
    setLoading(true);
    try {
      const token = resetToken || new URLSearchParams(window.location.search).get("reset_token") || "";
      const res = await fetch(`${AUTH_URL}?action=reset_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.newPassword }),
      });
      const d = await res.json();
      if (res.ok) {
        setSuccess("Пароль успешно изменён! Теперь войдите с новым паролем.");
        // Очищаем токен из URL
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => switchMode("login"), 2000);
      } else {
        setError(d.error || "Ошибка сброса пароля");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        const err = await login(form.email, form.password);
        if (err) { setError(err); return; }
      } else {
        const data: RegisterData = {
          fio: form.fio,
          email: form.email,
          password: form.password,
          role,
          phone: form.phone || undefined,
          ...(role === "employer"
            ? { company_name: form.company_name }
            : { company_id: form.company_id ? Number(form.company_id) : undefined }),
        };
        const err = await register(data);
        if (err) { setError(err); return; }
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Шапка */}
        <div className="bg-primary px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://cdn.poehali.dev/projects/cd71ce52-bb4a-42e1-b3e8-36fe92953b9e/bucket/f6918456-1a71-48db-8e71-dd06833a8284.png"
              alt="Логотип" className="w-8 h-8 rounded-full object-contain bg-white"
            />
            <div>
              <div className="text-white font-semibold text-sm">ОхранаТруда-Безопасность</div>
              <div className="text-white/70 text-xs">Платформа обучения</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <Icon name="X" size={20} fallback="X" />
          </button>
        </div>

        {/* ── ВОССТАНОВЛЕНИЕ ПАРОЛЯ (шаг 1) ── */}
        {mode === "forgot" && (
          <div className="p-6 space-y-4">
            <button onClick={() => switchMode("login")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1">
              <Icon name="ArrowLeft" size={14} fallback="Circle" /> Назад к входу
            </button>
            <div>
              <h2 className="font-semibold text-base">Восстановление пароля</h2>
              <p className="text-xs text-muted-foreground mt-1">Укажите email, который вы использовали при регистрации. Мы отправим ссылку для сброса пароля.</p>
            </div>

            {success ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-start">
                <Icon name="CheckCircle" size={18} className="text-green-600 shrink-0 mt-0.5" fallback="Circle" />
                <p className="text-sm text-green-800">{success}</p>
              </div>
            ) : (
              <form onSubmit={submitForgot} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Email</label>
                  <input
                    required type="email" value={form.email}
                    onChange={e => set("email", e.target.value)}
                    placeholder="ivanov@company.ru"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0" fallback="Circle" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {loading ? "Отправляем..." : "Отправить ссылку"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── СБРОС ПАРОЛЯ (шаг 2, по токену из URL) ── */}
        {mode === "reset" && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-base">Новый пароль</h2>
              <p className="text-xs text-muted-foreground mt-1">Придумайте новый пароль для вашего аккаунта.</p>
            </div>

            {success ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-start">
                <Icon name="CheckCircle" size={18} className="text-green-600 shrink-0 mt-0.5" fallback="Circle" />
                <p className="text-sm text-green-800">{success}</p>
              </div>
            ) : (
              <form onSubmit={submitReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Новый пароль</label>
                  <input
                    required type="password" value={form.newPassword}
                    onChange={e => set("newPassword", e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Повторите пароль</label>
                  <input
                    required type="password" value={form.newPassword2}
                    onChange={e => set("newPassword2", e.target.value)}
                    placeholder="Повторите новый пароль"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0" fallback="Circle" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {loading ? "Сохраняем..." : "Установить новый пароль"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── ВХОД / РЕГИСТРАЦИЯ ── */}
        {(mode === "login" || mode === "register") && (
          <>
            {/* Переключатель */}
            <div className="flex border-b border-border">
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === "login" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Вход
              </button>
              <button
                onClick={() => switchMode("register")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === "register" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Регистрация
              </button>
            </div>

            <form onSubmit={submitAuth} className="p-6 space-y-4">
              {/* Роль — только при регистрации */}
              {mode === "register" && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">Я регистрируюсь как</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["employee", "employer"] as const).map(r => (
                      <button
                        key={r} type="button"
                        onClick={() => setRole(r)}
                        className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          role === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <Icon name={r === "employer" ? "Building2" : "User"} size={16} className="mx-auto mb-1" fallback="Circle" />
                        {r === "employer" ? "Работодатель" : "Сотрудник"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ФИО */}
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-medium mb-1.5">ФИО *</label>
                  <input required value={form.fio} onChange={e => set("fio", e.target.value)}
                    placeholder="Иванов Иван Иванович"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-medium mb-1.5">Email *</label>
                <input required type="email" value={form.email} onChange={e => set("email", e.target.value)}
                  placeholder="ivanov@company.ru"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>

              {/* Пароль */}
              <div>
                <label className="block text-xs font-medium mb-1.5">Пароль *</label>
                <input required type="password" value={form.password} onChange={e => set("password", e.target.value)}
                  placeholder={mode === "register" ? "Минимум 6 символов" : "Ваш пароль"}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>

              {/* Ссылка "Забыли пароль" */}
              {mode === "login" && (
                <div className="text-right -mt-2">
                  <button type="button" onClick={() => switchMode("forgot")}
                    className="text-xs text-primary hover:underline">
                    Забыли пароль?
                  </button>
                </div>
              )}

              {/* Поля только для регистрации */}
              {mode === "register" && (
                <>
                  {role === "employer" ? (
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Название компании *</label>
                      <input required value={form.company_name} onChange={e => set("company_name", e.target.value)}
                        placeholder="ООО «Энергосервис»"
                        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Ваша компания *</label>
                      <select required value={form.company_id} onChange={e => set("company_id", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white transition-colors">
                        <option value="">— выберите компанию —</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {companies.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Компаний пока нет. Попросите работодателя зарегистрироваться первым.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1.5">Телефон <span className="text-muted-foreground font-normal">(по желанию)</span></label>
                    <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </>
              )}

              {/* Ошибка */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0" fallback="Circle" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {loading ? "Загрузка..." : (mode === "login" ? "Войти" : "Зарегистрироваться")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

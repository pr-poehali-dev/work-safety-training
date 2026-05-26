import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type RegisterData } from "@/contexts/AuthContext";

interface Props {
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({ onClose, initialMode = "login" }: Props) {
  const { login, register, getCompanies } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [role, setRole] = useState<"employee" | "employer">("employee");
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fio: "", email: "", password: "", phone: "",
    company_name: "", company_id: "",
  });

  useEffect(() => {
    getCompanies().then(setCompanies);
  }, []);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
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

        {/* Переключатель */}
        <div className="flex border-b border-border">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === "login" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Вход
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === "register" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
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

          {/* Поля только для регистрации */}
          {mode === "register" && (
            <>
              {/* Компания */}
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

              {/* Телефон */}
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

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? (mode === "login" ? "Входим..." : "Регистрируем...")
              : (mode === "login" ? "Войти" : "Зарегистрироваться")}
          </button>
        </form>
      </div>
    </div>
  );
}

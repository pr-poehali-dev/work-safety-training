import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { TESTS_DATA } from "@/data/tests";

export default function CabinetPanel({ onStartTest }: { onStartTest: (testId: string) => void }) {
  const { user, logout, notifications, unreadCount, assignedTests, markNotificationsRead, fetchNotifications } = useAuth();
  const [tab, setTab] = useState<"profile" | "notifications" | "tests">("profile");

  if (!user) return null;

  const initials = user.fio.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const handleNotifTab = () => {
    setTab("notifications");
    if (unreadCount > 0) markNotificationsRead();
    fetchNotifications();
  };

  const pendingTests = assignedTests.filter(t => !t.completed_at);
  const doneTests = assignedTests.filter(t => t.completed_at);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Раздел</p>
          <h1 className="text-2xl font-semibold">Личный кабинет</h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors"
        >
          <Icon name="LogOut" size={13} fallback="Circle" />
          Выйти
        </button>
      </div>

      {/* Карточка профиля */}
      <div className="bg-white border border-border rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base">{user.fio}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.company_name && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Icon name="Building2" size={11} fallback="Circle" />
              {user.company_name} · {user.role === "employer" ? "Работодатель" : "Сотрудник"}
            </p>
          )}
          {user.phone && (
            <p className="text-xs text-muted-foreground mt-0.5">{user.phone}</p>
          )}
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
          user.role === "employer" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
        }`}>
          {user.role === "employer" ? "Работодатель" : "Сотрудник"}
        </span>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { id: "profile", label: "Профиль", icon: "User" },
          { id: "notifications", label: `Уведомления${unreadCount > 0 ? ` (${unreadCount})` : ""}`, icon: "Bell" },
          { id: "tests", label: "Мои тесты", icon: "ClipboardCheck" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={t.id === "notifications" ? handleNotifTab : () => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
            } ${t.id === "notifications" && unreadCount > 0 ? "text-amber-600" : ""}`}
          >
            <Icon name={t.icon} size={14} fallback="Circle" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Профиль */}
      {tab === "profile" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "ФИО", value: user.fio },
            { label: "Email", value: user.email },
            { label: "Роль", value: user.role === "employer" ? "Работодатель" : "Сотрудник" },
            { label: "Компания", value: user.company_name || "—" },
            { label: "Телефон", value: user.phone || "Не указан" },
          ].map((row, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
              <p className="font-medium text-sm">{row.value}</p>
            </div>
          ))}
          <div className="bg-white border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Назначенных тестов</p>
            <p className="font-medium text-sm">{assignedTests.length} ({doneTests.length} пройдено)</p>
          </div>
        </div>
      )}

      {/* Уведомления */}
      {tab === "notifications" && (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="BellOff" size={36} className="mx-auto mb-3 opacity-25" fallback="Circle" />
              <p className="text-sm">Нет уведомлений</p>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`rounded-xl p-4 border transition-colors ${n.is_read ? "bg-white border-border" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm">{n.title}</p>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                <p className="text-xs text-muted-foreground mt-2 opacity-60">
                  {new Date(n.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Тесты */}
      {tab === "tests" && (
        <div className="space-y-4">
          {assignedTests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="ClipboardList" size={36} className="mx-auto mb-3 opacity-25" fallback="Circle" />
              <p className="text-sm">Назначенных тестов нет</p>
              <p className="text-xs mt-1">Тесты назначает ваш работодатель</p>
            </div>
          ) : (
            <>
              {pendingTests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">Ожидают прохождения</p>
                  <div className="space-y-2">
                    {pendingTests.map(t => {
                      const testData = TESTS_DATA.find(td => td.id === t.test_id);
                      return (
                        <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">{t.test_title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Назначил: {t.employer_fio}
                              {t.due_date && ` · Срок: ${new Date(t.due_date).toLocaleDateString("ru-RU")}`}
                            </p>
                          </div>
                          {testData && (
                            <button
                              onClick={() => onStartTest(t.test_id)}
                              className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
                            >
                              Пройти
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {doneTests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-2">Пройденные</p>
                  <div className="space-y-2">
                    {doneTests.map(t => (
                      <div key={t.id} className="bg-white border border-border rounded-xl p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{t.test_title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.completed_at && new Date(t.completed_at).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                        <span className={`shrink-0 font-bold text-sm ${(t.score || 0) >= 80 ? "text-green-600" : "text-red-500"}`}>
                          {t.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

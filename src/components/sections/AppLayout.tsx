import { useRef, type ReactNode } from "react";
import Icon from "@/components/ui/icon";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS: { id: string; label: string; icon: string; employerOnly?: boolean }[] = [
  { id: "home", label: "Главная", icon: "LayoutDashboard" },
  { id: "info", label: "Информация", icon: "BookOpen" },
  { id: "tests", label: "Тестирование", icon: "ClipboardCheck" },
  { id: "briefings", label: "Инструктажи", icon: "Users" },
  { id: "checklists", label: "Чек-листы", icon: "ListChecks" },
  { id: "contacts", label: "Контакты", icon: "MessageSquare" },
  { id: "employer", label: "Сотрудники", icon: "Building2", employerOnly: true },
];

interface AppLayoutProps {
  children: ReactNode;
  active: string;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  notification: boolean;
  setNotification: (v: boolean) => void;
  avatarMenu: boolean;
  setAvatarMenu: (v: (prev: boolean) => boolean) => void;
  avatarMenuRef: React.RefObject<HTMLDivElement>;
  chatUnread: number;
  authModal: false | "login" | "register" | "forgot" | "reset";
  setAuthModal: (v: false | "login" | "register" | "forgot" | "reset") => void;
  resetToken: string;
  setResetToken: (v: string) => void;
  navigate: (id: string, opts?: { cabinetTab?: "profile" | "notifications" | "tests" }) => void;
  setChatReceiverId: (v: number | undefined) => void;
  setChatSubject: (v: string) => void;
}

function LogoutButton({ onDone }: { onDone: () => void }) {
  const { logout } = useAuth();
  return (
    <button
      onClick={async () => { await logout(); onDone(); }}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted text-red-600 transition-colors text-left"
    >
      <Icon name="LogOut" size={15} fallback="Circle" />
      Выйти
    </button>
  );
}

export default function AppLayout({
  children,
  active,
  sidebarOpen,
  setSidebarOpen,
  notification,
  setNotification,
  avatarMenu,
  setAvatarMenu,
  avatarMenuRef,
  chatUnread,
  authModal,
  setAuthModal,
  resetToken,
  setResetToken,
  navigate,
  setChatReceiverId,
  setChatSubject,
}: AppLayoutProps) {
  const { user, unreadCount, loading: authLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background font-ibm flex flex-col">
      {notification && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Icon name="Bell" size={14} />
            <span className="font-medium">Напоминание:</span>
            <span>Повторный инструктаж по охране труда — через 14 дней (08.06.2026)</span>
          </div>
          <button onClick={() => setNotification(false)} className="text-amber-500 hover:text-amber-700 ml-4">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden mr-1" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Icon name="Menu" size={20} />
            </button>
            <div className="flex items-center gap-2">
              <img
                src="https://cdn.poehali.dev/projects/cd71ce52-bb4a-42e1-b3e8-36fe92953b9e/bucket/f6918456-1a71-48db-8e71-dd06833a8284.png"
                alt="Логотип"
                className="w-8 h-8 object-contain rounded-full"
              />
              <span className="font-semibold text-base tracking-tight hidden sm:block">ОхранаТруда-Безопасность</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.filter(item => !item.employerOnly || user?.role === "employer").map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  active === item.id
                    ? "text-primary bg-primary/8 font-semibold"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => navigate("cabinet", { cabinetTab: "notifications" })}
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary relative"
              >
                <Icon name="Bell" size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            )}

            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <div className="relative" ref={avatarMenuRef}>
                <button
                  onClick={() => setAvatarMenu(v => !v)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  {user.fio.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </button>
                {avatarMenu && (
                  <div className="absolute right-0 top-10 z-[200] bg-white border border-border rounded-xl shadow-xl w-56 py-1 animate-fade-in">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="font-medium text-sm truncate">{user.fio}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{user.role === "employer" ? "Работодатель" : "Сотрудник"}</p>
                    </div>
                    <button
                      onClick={() => { setAvatarMenu(v => !v); navigate("cabinet"); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Icon name="UserCircle" size={15} fallback="Circle" />
                      Личный кабинет
                    </button>
                    {user.company_id && (
                      <button
                        onClick={() => { setAvatarMenu(v => !v); setChatReceiverId(undefined); setChatSubject(""); navigate("messages"); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                      >
                        <Icon name="MessageSquare" size={15} fallback="Circle" />
                        Переписка
                        {chatUnread > 0 && (
                          <span className="ml-auto w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                            {chatUnread > 9 ? "9+" : chatUnread}
                          </span>
                        )}
                      </button>
                    )}
                    <div className="border-t border-border mt-1">
                      <LogoutButton onDone={() => { setAvatarMenu(v => !v); navigate("home"); }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModal("login")}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
              >
                <Icon name="LogIn" size={14} fallback="Circle" />
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setSidebarOpen(false)}>
          <div className="bg-white w-64 h-full shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6 mt-1">
              <img
                src="https://cdn.poehali.dev/projects/cd71ce52-bb4a-42e1-b3e8-36fe92953b9e/bucket/f6918456-1a71-48db-8e71-dd06833a8284.png"
                alt="Логотип"
                className="w-8 h-8 object-contain rounded-full"
              />
              <span className="font-semibold text-sm leading-tight">ОхранаТруда-<br/>Безопасность</span>
            </div>
            {NAV_ITEMS.filter(item => !item.employerOnly || user?.role === "employer").map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mb-1 text-left ${
                  active === item.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <Icon name={item.icon} size={16} fallback="Circle" />
                {item.label}
              </button>
            ))}
            <div className="border-t border-border mt-2 pt-2">
              {user ? (
                <button onClick={() => navigate("cabinet")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mb-1 text-left hover:bg-muted">
                  <Icon name="UserCircle" size={16} fallback="Circle" />
                  Личный кабинет
                </button>
              ) : (
                <button onClick={() => { setSidebarOpen(false); setAuthModal("login"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-primary font-medium text-left">
                  <Icon name="LogIn" size={16} fallback="Circle" />
                  Войти / Регистрация
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>

      {authModal && (
        <AuthModal
          initialMode={authModal}
          resetToken={resetToken}
          onClose={() => { setAuthModal(false); setResetToken(""); }}
        />
      )}

      <footer className="border-t border-border bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img
              src="https://cdn.poehali.dev/projects/cd71ce52-bb4a-42e1-b3e8-36fe92953b9e/bucket/f6918456-1a71-48db-8e71-dd06833a8284.png"
              alt="Логотип"
              className="w-6 h-6 object-contain rounded-full"
            />
            <span>ОхранаТруда-Безопасность · Платформа обучения</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 · Все права защищены</p>
        </div>
      </footer>
    </div>
  );
}

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const AUTH_URL = "https://functions.poehali.dev/392fdf32-3b9a-4824-a62c-d8e2ece4e885";
const EMPLOYER_URL = "https://functions.poehali.dev/2db38725-d446-4c74-8d25-b78ef3437142";
const EMPLOYEE_URL = "https://functions.poehali.dev/de591658-effe-4af5-b2e2-1a3f02c62689";

export interface User {
  id: number;
  fio: string;
  email: string;
  role: "employer" | "employee";
  company_id: number | null;
  company_name: string | null;
  phone: string | null;
}

export interface Company {
  id: number;
  name: string;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface AssignedTest {
  id: number;
  test_id: string;
  test_title: string;
  assigned_at: string;
  due_date: string | null;
  completed_at: string | null;
  score: number | null;
  employer_fio?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  notifications: Notification[];
  unreadCount: number;
  assignedTests: AssignedTest[];
  login: (email: string, password: string) => Promise<string | null>;
  register: (data: RegisterData) => Promise<string | null>;
  logout: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  fetchAssignedTests: () => Promise<void>;
  completeTest: (test_id: string, score: number) => Promise<void>;
  getCompanies: () => Promise<Company[]>;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  EMPLOYER_URL: string;
  EMPLOYEE_URL: string;
}

export interface RegisterData {
  fio: string;
  email: string;
  password: string;
  role: "employer" | "employee";
  phone?: string;
  company_name?: string;
  company_id?: number;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [assignedTests, setAssignedTests] = useState<AssignedTest[]>([]);

  const authFetch = (url: string, opts: RequestInit = {}) => {
    const sid = getCookie("session_id");
    return fetch(url, {
      ...opts,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(sid ? { Cookie: `session_id=${sid}`, Authorization: `Bearer ${sid}` } : {}),
        ...(opts.headers || {}),
      },
    });
  };

  const sid = () => getCookie("session_id");

  const fetchMe = async () => {
    try {
      const s = sid();
      if (!s) { setLoading(false); return; }
      const res = await fetch(`${AUTH_URL}?action=me`, {
        headers: { "X-Cookie": `session_id=${s}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMe(); }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchAssignedTests();
    } else {
      setNotifications([]);
      setAssignedTests([]);
    }
  }, [user?.id]);

  const applyCookie = (res: Response) => {
    const setCookie = res.headers.get("X-Set-Cookie");
    if (setCookie) {
      const [cookiePart] = setCookie.split(";");
      const [name, value] = cookiePart.split("=");
      document.cookie = `${name}=${value}; Path=/; Max-Age=2592000; SameSite=Lax`;
    }
    // Также читаем session_id из тела ответа если есть
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${AUTH_URL}?action=login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Ошибка входа";
      applyCookie(res);
      // Сохраняем session_id напрямую из тела если cookie не пришёл
      if (data.session_id) {
        document.cookie = `session_id=${data.session_id}; Path=/; Max-Age=2592000; SameSite=Lax`;
      }
      setUser(data.user);
      return null;
    } catch {
      return "Ошибка соединения с сервером";
    }
  };

  const register = async (regData: RegisterData): Promise<string | null> => {
    try {
      const res = await fetch(`${AUTH_URL}?action=register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regData),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Ошибка регистрации";
      applyCookie(res);
      if (data.session_id) {
        document.cookie = `session_id=${data.session_id}; Path=/; Max-Age=2592000; SameSite=Lax`;
      }
      setUser(data.user);
      return null;
    } catch {
      return "Ошибка соединения с сервером";
    }
  };

  const logout = async () => {
    const s = sid();
    await fetch(`${AUTH_URL}?action=logout`, {
      method: "POST",
      headers: { "X-Cookie": `session_id=${s}`, "Content-Type": "application/json" },
    }).catch(() => {});
    document.cookie = "session_id=; Path=/; Max-Age=0";
    setUser(null);
  };

  const fetchNotifications = async () => {
    try {
      const s = sid();
      if (!s) return;
      const res = await fetch(`${EMPLOYEE_URL}?action=notifications`, {
        headers: { "X-Cookie": `session_id=${s}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch { /* ignore */ }
  };

  const markNotificationsRead = async () => {
    try {
      const s = sid();
      if (!s) return;
      await fetch(`${EMPLOYEE_URL}?action=read`, {
        method: "POST",
        headers: { "X-Cookie": `session_id=${s}`, "Content-Type": "application/json" },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  const fetchAssignedTests = async () => {
    try {
      const s = sid();
      if (!s) return;
      const res = await fetch(`${EMPLOYEE_URL}?action=assigned`, {
        headers: { "X-Cookie": `session_id=${s}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignedTests(data.tests || []);
      }
    } catch { /* ignore */ }
  };

  const completeTest = async (test_id: string, score: number) => {
    try {
      const s = sid();
      if (!s) return;
      await fetch(`${EMPLOYEE_URL}?action=complete`, {
        method: "POST",
        headers: { "X-Cookie": `session_id=${s}`, "Content-Type": "application/json" },
        body: JSON.stringify({ test_id, score }),
      });
      await fetchAssignedTests();
    } catch { /* ignore */ }
  };

  const getCompanies = async (): Promise<Company[]> => {
    try {
      const res = await fetch(`${AUTH_URL}?action=companies`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.companies || [];
    } catch {
      return [];
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <AuthContext.Provider value={{
      user, loading, notifications, unreadCount, assignedTests,
      login, register, logout,
      fetchNotifications, markNotificationsRead,
      fetchAssignedTests, completeTest,
      getCompanies, authFetch,
      EMPLOYER_URL, EMPLOYEE_URL,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
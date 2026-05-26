import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";

const DOCS_URL = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";

function getCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function authH() {
  const sid = getCookie("session_id");
  return { "Content-Type": "application/json", ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}) };
}

async function api(action: string, opts: RequestInit = {}, qs: Record<string, string> = {}) {
  const p = new URLSearchParams({ action, ...qs });
  return fetch(`${DOCS_URL}?${p}`, { ...opts, headers: { ...authH(), ...(opts.headers as Record<string, string> || {}) } });
}

interface Contact {
  id: number;
  fio: string;
  email: string;
  unread: number;
  last_at: string | null;
  last_msg: string | null;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  initialReceiverId?: number;
  initialSubject?: string;
  onUnreadChange?: (count: number) => void;
}

export default function CompanyChat({ initialReceiverId, initialSubject, onUnreadChange }: Props) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialReceiverId || null);
  const [selectedFio, setSelectedFio] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState(initialSubject || "");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadContacts = useCallback(async () => {
    const res = await api("msg_list");
    if (res.ok) {
      const data = await res.json();
      setContacts(data.contacts || []);
      const total = (data.contacts || []).reduce((s: number, c: Contact) => s + (c.unread || 0), 0);
      onUnreadChange?.(total);
    }
    setLoadingContacts(false);
  }, [onUnreadChange]);

  const loadThread = useCallback(async (otherId: number) => {
    setLoadingMsgs(true);
    const res = await api("msg_thread", {}, { with_user_id: String(otherId) });
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
      setSelectedFio(data.other?.fio || "");
    }
    setLoadingMsgs(false);
  }, []);

  // Первичная загрузка
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Если передан initialReceiverId — сразу открываем диалог
  useEffect(() => {
    if (initialReceiverId) {
      setSelectedId(initialReceiverId);
      loadThread(initialReceiverId);
    }
  }, [initialReceiverId, loadThread]);

  // Выбор собеседника
  const selectContact = async (c: Contact) => {
    setSelectedId(c.id);
    setSelectedFio(c.fio);
    await loadThread(c.id);
    // Обновляем счётчик непрочитанных
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, unread: 0 } : x));
    onUnreadChange?.(contacts.reduce((s, x) => s + (x.id === c.id ? 0 : (x.unread || 0)), 0));
  };

  // Автопрокрутка вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Поллинг новых сообщений раз в 10 сек
  useEffect(() => {
    if (!selectedId) return;
    pollRef.current = setInterval(() => loadThread(selectedId), 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, loadThread]);

  const send = async () => {
    if (!text.trim() || !selectedId) return;
    setSending(true);
    const res = await api("msg_send", {
      method: "POST",
      body: JSON.stringify({ receiver_id: selectedId, body: text.trim(), subject }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: data.message_id,
        sender_id: user!.id,
        receiver_id: selectedId,
        subject: data.subject || "",
        body: text.trim(),
        is_read: false,
        created_at: data.created_at || new Date().toISOString(),
      }]);
      setText("");
      setSubject("");
      loadContacts();
    }
    setSending(false);
  };

  const deleteMessage = async (msgId: number) => {
    setDeletingId(msgId);
    const res = await api("msg_delete", {
      method: "POST",
      body: JSON.stringify({ message_id: msgId }),
    });
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      loadContacts();
    }
    setDeletingId(null);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + " " +
        d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  if (!user) return null;

  return (
    <div className="flex h-[600px] bg-white border border-border rounded-xl overflow-hidden">
      {/* ── Список собеседников ── */}
      <div className="w-64 border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="font-semibold text-sm flex items-center gap-2">
            <Icon name="MessageSquare" size={14} className="text-primary" fallback="Circle" />
            Переписка
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user.role === "employer" ? "Сотрудники компании" : "Специалист по ОТ"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground mt-4">
              <Icon name="Users" size={24} className="mx-auto mb-2 opacity-30" fallback="Circle" />
              {user.role === "employer" ? "Нет сотрудников в компании" : "Специалист по ОТ не зарегистрирован"}
            </div>
          ) : (
            contacts.map(c => (
              <button
                key={c.id}
                onClick={() => selectContact(c)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/40 transition-colors ${selectedId === c.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="font-medium text-sm truncate">{c.fio}</p>
                  {c.unread > 0 && (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </div>
                {c.last_msg && (
                  <p className="text-xs text-muted-foreground truncate">{c.last_msg}</p>
                )}
                {c.last_at && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{formatTime(c.last_at)}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Область чата ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <Icon name="MessageSquare" size={40} className="text-muted-foreground/20 mb-4" fallback="Circle" />
            <p className="font-medium text-muted-foreground">Выберите собеседника</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {user.role === "employee"
                ? "Нажмите на специалиста по ОТ слева, чтобы начать переписку"
                : "Выберите сотрудника из списка"}
            </p>
          </div>
        ) : (
          <>
            {/* Шапка чата */}
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">
                {selectedFio.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{selectedFio}</p>
                <p className="text-xs text-muted-foreground">
                  {user.role === "employer" ? "Сотрудник" : "Специалист по ОТ"}
                </p>
              </div>
              <button
                onClick={() => loadThread(selectedId)}
                className="ml-auto p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                title="Обновить"
              >
                <Icon name="RefreshCw" size={14} fallback="Circle" />
              </button>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                      <div className="h-10 w-48 bg-muted animate-pulse rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <Icon name="MessageCircle" size={32} className="text-muted-foreground/20 mb-3" fallback="Circle" />
                  <p className="text-sm text-muted-foreground">Сообщений пока нет</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Напишите первое сообщение</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_id === user.id;
                  const isDeleting = deletingId === msg.id;
                  return (
                    <div key={msg.id} className={`flex group ${isMine ? "justify-end" : "justify-start"}`}>
                      {/* Кнопка удаления — только своих, появляется при hover */}
                      {isMine && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          disabled={isDeleting}
                          className="self-center mr-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-100 text-muted-foreground hover:text-red-500 shrink-0 disabled:opacity-40"
                          title="Удалить сообщение"
                        >
                          <Icon name={isDeleting ? "Loader2" : "Trash2"} size={13} fallback="Trash" className={isDeleting ? "animate-spin" : ""} />
                        </button>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isMine
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        {msg.subject && (
                          <p className={`text-xs font-semibold mb-1 ${isMine ? "text-white/80" : "text-muted-foreground"}`}>
                            Тема: {msg.subject}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        <p className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-muted-foreground"} text-right`}>
                          {formatTime(msg.created_at)}
                          {isMine && (
                            <span className="ml-1">
                              {msg.is_read ? " ✓✓" : " ✓"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Поле ввода */}
            <div className="border-t border-border p-3 space-y-2">
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Тема (необязательно)"
                className="w-full text-xs border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Напишите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
                  rows={2}
                  className="flex-1 text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary resize-none"
                />
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="w-10 h-10 self-end rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
                >
                  <Icon name="Send" size={16} fallback="Circle" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground/60">Enter — отправить · Shift+Enter — новая строка</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
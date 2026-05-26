import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { SavedCard } from "@/components/TemplateEditor";

const DOCS_URL = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";

function getCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}
function authH() {
  const sid = getCookie("session_id");
  return { "Content-Type": "application/json", ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}) };
}
async function apiFetch(action: string, qs: Record<string, string> = {}) {
  const p = new URLSearchParams({ action, ...qs });
  return fetch(`${DOCS_URL}?${p}`, { headers: authH() });
}

interface Props {
  cardType: "sout" | "profrisk";
  onEdit: (card: SavedCard) => void;
}

export default function EmployerSavedCards({ cardType, onEdit }: Props) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("card_list", { card_type: cardType });
    if (res.ok) { const d = await res.json(); setCards(d.cards || []); }
    setLoading(false);
  }, [cardType]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="space-y-2">{[1,2].map(i=><div key={i} className="h-16 bg-muted animate-pulse rounded-xl"/>)}</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
        <Icon name="FileX" size={28} className="mx-auto mb-2 opacity-25" fallback="Circle" />
        <p className="text-sm">Сохранённых карт нет</p>
        <p className="text-xs mt-1">Заполните шаблон и нажмите «Сохранить карту»</p>
      </div>
    );
  }

  const isSout = cardType === "sout";

  return (
    <div className="space-y-2">
      {cards.map(card => {
        const sentTo = card.assignments?.length || 0;
        const readBy = card.assignments?.filter(a => a.read_at).length || 0;
        return (
          <div key={card.card_id} className={`rounded-xl border p-4 ${isSout ? "bg-green-50/60 border-green-200" : "bg-amber-50/60 border-amber-200"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSout ? "bg-green-100" : "bg-amber-100"}`}>
                <Icon name={isSout ? "ClipboardList" : "AlertOctagon"} size={18}
                  className={isSout ? "text-green-700" : "text-amber-700"} fallback="Circle" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{card.title}</p>
                {sentTo > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Отправлено: {sentTo} · Ознакомились: {readBy}
                  </p>
                )}
              </div>
              <button
                onClick={() => onEdit(card)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-primary/30 bg-white hover:bg-primary/5 text-primary transition-colors"
              >
                <Icon name="FileEdit" size={13} fallback="Circle" /> Открыть
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

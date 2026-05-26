import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { fetchContacts, saveContacts, type CompanyContact } from "@/lib/docsApi";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  companyId: number;
  companyName: string;
}

const EMPTY: CompanyContact = {
  specialist_name: "", phone: "", email: "", office: "", schedule: "",
};

export default function CompanyContacts({ companyId, companyName }: Props) {
  const { user } = useAuth();
  const isEmployer = user?.role === "employer";

  const [contacts, setContacts] = useState<CompanyContact>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CompanyContact>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    setLoading(true);
    fetchContacts(companyId).then(c => {
      if (c) { setContacts(c); setForm(c); }
      setLoading(false);
    });
  }, [companyId]);

  const startEdit = () => { setForm({ ...contacts }); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setForm({ ...contacts }); };

  const save = async () => {
    setSaving(true);
    const ok = await saveContacts(form);
    setSaving(false);
    if (ok) {
      setContacts({ ...form });
      setEditing(false);
      showToast("Контакты сохранены");
    } else {
      showToast("Ошибка сохранения");
    }
  };

  const setF = (k: keyof CompanyContact, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const fields: { key: keyof CompanyContact; label: string; icon: string; placeholder: string }[] = [
    { key: "specialist_name", label: "Специалист по ОТ", icon: "User", placeholder: "Петрова Марина Сергеевна" },
    { key: "phone", label: "Телефон", icon: "Phone", placeholder: "+7 (495) 123-45-67 доб. 201" },
    { key: "email", label: "E-mail", icon: "Mail", placeholder: "ot@company.ru" },
    { key: "office", label: "Кабинет", icon: "MapPin", placeholder: "Корпус А, каб. 214" },
    { key: "schedule", label: "Приём", icon: "Clock", placeholder: "Пн–Пт, 9:00–17:00" },
  ];

  if (loading) {
    return <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Icon name="CheckCircle" size={16} fallback="Circle" /> {toast}
        </div>
      )}

      <div className="bg-white border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Icon name="Building2" size={16} className="text-primary" fallback="Circle" />
            {companyName} — Служба охраны труда
          </h2>
          {isEmployer && !editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors">
              <Icon name="Pencil" size={12} fallback="Circle" />
              Редактировать
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1">{f.label}</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Icon name={f.icon} size={14} className="text-muted-foreground" fallback="Circle" />
                  </div>
                  <input
                    value={form[f.key]}
                    onChange={e => setF(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-60">
                <Icon name="Save" size={13} fallback="Circle" />
                {saving ? "Сохраняем..." : "Сохранить"}
              </button>
              <button onClick={cancelEdit}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map(f => (
              <div key={f.key} className="flex items-start gap-3">
                <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name={f.icon} size={13} className="text-primary" fallback="Circle" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-medium mt-0.5">
                    {contacts[f.key] || <span className="text-muted-foreground italic">Не указано</span>}
                  </p>
                </div>
              </div>
            ))}
            {isEmployer && !contacts.specialist_name && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 mt-2">
                <Icon name="Info" size={14} className="text-amber-600 shrink-0 mt-0.5" fallback="Circle" />
                <p className="text-xs text-amber-700">Заполните контактную информацию — сотрудники смогут её видеть.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

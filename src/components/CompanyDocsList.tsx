import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { fetchMyDocs, markDocRead, type CompanyDoc } from "@/lib/docsApi";

interface Props {
  docType: "sout" | "profrisk";
}

export default function CompanyDocsList({ docType }: Props) {
  const [docs, setDocs] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const all = await fetchMyDocs();
    setDocs(all.filter(d => d.doc_type === docType));
    setLoading(false);
  };

  useEffect(() => { load(); }, [docType]);

  const handleRead = async (id: number) => {
    await markDocRead(id);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, read_at: new Date().toISOString() } : d));
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Icon name="FileX" size={32} className="mx-auto mb-2 opacity-25" fallback="Circle" />
        <p className="text-sm">Документов от работодателя пока нет</p>
      </div>
    );
  }

  const isSout = docType === "sout";
  const colorClass = isSout ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200";
  const iconColor = isSout ? "text-green-700" : "text-amber-700";
  const iconName = isSout ? "ClipboardList" : "AlertOctagon";
  const badgeClass = isSout ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Документы, направленные вашим работодателем для ознакомления</p>
      {docs.map(doc => (
        <div key={doc.id} className={`rounded-xl border p-4 ${colorClass}`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSout ? "bg-green-100" : "bg-amber-100"}`}>
              <Icon name={iconName} size={18} className={iconColor} fallback="Circle" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-semibold text-sm">{doc.title}</p>
                {doc.read_at ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                    <Icon name="CheckCircle" size={10} fallback="Check" /> Ознакомлен
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                    Требует ознакомления
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{doc.file_name}</p>
              {doc.assigned_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Получен: {new Date(doc.assigned_at).toLocaleDateString("ru-RU")}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted transition-colors font-medium">
              <Icon name="Eye" size={13} fallback="Circle" />
              Открыть документ
            </a>
            {!doc.read_at && (
              <button onClick={() => handleRead(doc.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors text-white ${isSout ? "bg-green-600 hover:bg-green-700" : "bg-amber-500 hover:bg-amber-600"}`}>
                <Icon name="CheckCircle" size={13} fallback="Circle" />
                Отметить ознакомленным
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

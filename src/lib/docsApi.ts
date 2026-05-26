const DOCS_URL = "https://functions.poehali.dev/514ab62a-455e-4cf0-a4d2-03efb7296ff4";

function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function authHeaders(): Record<string, string> {
  const sid = getCookie("session_id");
  return {
    "Content-Type": "application/json",
    ...(sid ? { "X-Cookie": `session_id=${sid}` } : {}),
  };
}

export const DOCS_API_URL = DOCS_URL;

export async function apiDocs(action: string, opts: RequestInit = {}, qs: Record<string, string> = {}) {
  const params = new URLSearchParams({ action, ...qs });
  return fetch(`${DOCS_URL}?${params}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers as Record<string, string> || {}) },
  });
}

export interface CompanyDoc {
  id: number;
  doc_type: "sout" | "profrisk";
  title: string;
  file_url: string;
  file_name: string;
  created_at: string;
  // employer view
  assignments?: Array<{ employee_id: number; fio: string; assigned_at: string; read_at: string | null }>;
  // employee view
  assigned_at?: string;
  read_at?: string | null;
}

export interface CompanyContact {
  specialist_name: string;
  phone: string;
  email: string;
  office: string;
  schedule: string;
}

export async function fetchMyDocs(): Promise<CompanyDoc[]> {
  const res = await apiDocs("list");
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

export async function fetchContacts(company_id: number): Promise<CompanyContact | null> {
  const res = await apiDocs("contacts_get", {}, { company_id: String(company_id) });
  if (!res.ok) return null;
  const data = await res.json();
  return data.contacts || null;
}

export async function saveContacts(contacts: CompanyContact): Promise<boolean> {
  const res = await apiDocs("contacts_save", {
    method: "POST",
    body: JSON.stringify(contacts),
  });
  return res.ok;
}

export async function markDocRead(document_id: number): Promise<void> {
  await apiDocs("mark_read", { method: "POST", body: JSON.stringify({ document_id }) });
}

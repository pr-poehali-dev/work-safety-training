-- Документы компании (СОУТ и ПрофРиски), загруженные работодателем
CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.company_documents (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.companies(id),
    employer_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    doc_type TEXT NOT NULL CHECK (doc_type IN ('sout', 'profrisk')),
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Кому отправлен документ (сотрудник компании)
CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.document_assignments (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.company_documents(id),
    employee_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    UNIQUE(document_id, employee_id)
);

-- Контакты компании (редактируются работодателем)
CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.company_contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL UNIQUE REFERENCES t_p46787666_work_safety_training.companies(id),
    specialist_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    office TEXT DEFAULT '',
    schedule TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_docs_company_idx ON t_p46787666_work_safety_training.company_documents(company_id);
CREATE INDEX IF NOT EXISTS doc_assign_employee_idx ON t_p46787666_work_safety_training.document_assignments(employee_id);

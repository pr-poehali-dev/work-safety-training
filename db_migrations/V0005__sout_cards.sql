CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.sout_cards (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.companies(id),
    employer_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    card_type TEXT NOT NULL CHECK (card_type IN ('sout', 'profrisk')),
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    filled_values JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.sout_card_assignments (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.sout_cards(id),
    employee_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    UNIQUE(card_id, employee_id)
);

CREATE INDEX IF NOT EXISTS sout_cards_company_idx ON t_p46787666_work_safety_training.sout_cards(company_id);
CREATE INDEX IF NOT EXISTS sout_assign_emp_idx ON t_p46787666_work_safety_training.sout_card_assignments(employee_id);

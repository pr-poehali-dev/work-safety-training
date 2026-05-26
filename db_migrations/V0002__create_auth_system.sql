CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.users (
    id SERIAL PRIMARY KEY,
    fio TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('employer', 'employee')),
    company_id INTEGER REFERENCES t_p46787666_work_safety_training.companies(id),
    phone TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.assigned_tests (
    id SERIAL PRIMARY KEY,
    employer_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    employee_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    test_id TEXT NOT NULL,
    test_title TEXT NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    due_date DATE,
    completed_at TIMESTAMP,
    score INTEGER,
    UNIQUE(employee_id, test_id)
);

CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON t_p46787666_work_safety_training.sessions(user_id);
CREATE INDEX IF NOT EXISTS assigned_tests_employee_idx ON t_p46787666_work_safety_training.assigned_tests(employee_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON t_p46787666_work_safety_training.notifications(user_id);

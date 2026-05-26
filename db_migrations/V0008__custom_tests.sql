CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.custom_tests (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.companies(id),
    employer_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    passing_score INTEGER NOT NULL DEFAULT 80,
    time_limit INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.custom_test_questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.custom_tests(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    correct INTEGER NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS custom_tests_company_idx ON t_p46787666_work_safety_training.custom_tests(company_id);
CREATE INDEX IF NOT EXISTS custom_test_questions_test_idx ON t_p46787666_work_safety_training.custom_test_questions(test_id);

ALTER TABLE t_p46787666_work_safety_training.assigned_tests
    ADD COLUMN IF NOT EXISTS custom_test_id INTEGER;

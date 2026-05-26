CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.assigned_briefings (
    id SERIAL PRIMARY KEY,
    employer_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    employee_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    briefing_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.custom_briefings(id),
    briefing_title TEXT NOT NULL DEFAULT '',
    assigned_at TIMESTAMP DEFAULT NOW(),
    due_date DATE,
    completed_at TIMESTAMP,
    UNIQUE(employee_id, briefing_id)
);

CREATE INDEX IF NOT EXISTS assigned_briefings_employee_idx ON t_p46787666_work_safety_training.assigned_briefings(employee_id);
CREATE INDEX IF NOT EXISTS assigned_briefings_employer_idx ON t_p46787666_work_safety_training.assigned_briefings(employer_id);
CREATE INDEX IF NOT EXISTS assigned_briefings_briefing_idx ON t_p46787666_work_safety_training.assigned_briefings(briefing_id);

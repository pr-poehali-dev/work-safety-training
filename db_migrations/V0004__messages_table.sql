CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.messages (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.companies(id),
    sender_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    receiver_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_company_idx ON t_p46787666_work_safety_training.messages(company_id);
CREATE INDEX IF NOT EXISTS messages_receiver_idx ON t_p46787666_work_safety_training.messages(receiver_id);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON t_p46787666_work_safety_training.messages(sender_id);

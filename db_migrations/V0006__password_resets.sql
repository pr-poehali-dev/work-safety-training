CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.password_resets (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS pw_resets_user_idx ON t_p46787666_work_safety_training.password_resets(user_id);

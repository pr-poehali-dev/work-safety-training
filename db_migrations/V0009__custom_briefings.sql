CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.custom_briefings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.companies(id),
    employer_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.users(id),
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    duration INTEGER NOT NULL DEFAULT 30,
    source_briefing_id TEXT NOT NULL DEFAULT '',
    source_variant_id TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.custom_briefing_blocks (
    id SERIAL PRIMARY KEY,
    briefing_id INTEGER NOT NULL REFERENCES t_p46787666_work_safety_training.custom_briefings(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    block_type TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS custom_briefings_company_idx ON t_p46787666_work_safety_training.custom_briefings(company_id);
CREATE INDEX IF NOT EXISTS custom_briefing_blocks_briefing_idx ON t_p46787666_work_safety_training.custom_briefing_blocks(briefing_id);

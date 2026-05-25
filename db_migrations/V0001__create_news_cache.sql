CREATE TABLE IF NOT EXISTS t_p46787666_work_safety_training.news_cache (
    id SERIAL PRIMARY KEY,
    tag VARCHAR(50) NOT NULL DEFAULT 'Новость',
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    published_at DATE,
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_cache_fetched_at_idx
    ON t_p46787666_work_safety_training.news_cache (fetched_at DESC);

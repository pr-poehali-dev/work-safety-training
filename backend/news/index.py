"""
Получение новостей Минтруда России через RSS-ленту (mintrud.gov.ru/rss).
Фильтрация по категории «Охрана труда». Кэш в БД — обновляется раз в сутки.
"""
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

import psycopg2


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")
RSS_URL = "https://mintrud.gov.ru/rss"

OT_KEYWORDS = [
    "охрана труда", "безопасность труда", "несчастный случай", "производственный травматизм",
    "специальная оценка", "соут", "профессиональный риск", "средства защиты", "сиз",
    "инструктаж", "электробезопасность", "работа на высоте", "вредные условия",
    "медосмотр", "профзаболевани", "инспекция труда", "гит", "роструд",
    "внот", "неделя охраны труда",
]


# ─── Парсинг RSS ──────────────────────────────────────────────────────────────
def parse_rss() -> list[dict]:
    """Скачивает RSS Минтруда и возвращает новости по охране труда."""
    req = urllib.request.Request(
        RSS_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; OTNewsBot/1.0)",
            "Accept": "application/rss+xml, application/xml, text/xml",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()

    root = ET.fromstring(raw)
    channel = root.find("channel")
    if channel is None:
        return []

    items = []
    for item in channel.findall("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        description = (item.findtext("description") or "").strip()
        category = (item.findtext("category") or "").strip()
        pub_date_raw = (item.findtext("pubDate") or "").strip()

        if not title or not link:
            continue

        # Фильтр: только новости по охране труда
        combined = (title + " " + description + " " + category).lower()
        is_ot = (
            "охрана труда" in category.lower()
            or "/labour/safety" in link
            or any(kw in combined for kw in OT_KEYWORDS)
        )
        if not is_ot:
            continue

        # Очищаем HTML из описания
        desc_clean = re.sub(r"<[^>]+>", "", description)
        desc_clean = re.sub(r"&[a-z#0-9]+;", " ", desc_clean)
        desc_clean = re.sub(r"\s+", " ", desc_clean).strip()
        if len(desc_clean) > 300:
            desc_clean = desc_clean[:297] + "…"

        pub_date = parse_rfc_date(pub_date_raw)

        items.append({
            "tag": classify_tag(title, category),
            "title": title,
            "description": desc_clean or None,
            "url": link,
            "published_at": pub_date,
        })

    return items[:20]


def parse_rfc_date(raw: str) -> str | None:
    """Парсит дату формата RFC-822 из RSS (Mon, 18 May 2026 11:00:49 +0300)."""
    if not raw:
        return None
    try:
        clean = re.sub(r"\s+[+-]\d{4}$", "", raw.strip())
        dt = datetime.strptime(clean, "%a, %d %b %Y %H:%M:%S")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    m = re.search(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", raw)
    if m:
        try:
            dt = datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%d %b %Y")
            return dt.strftime("%Y-%m-%d")
        except Exception:
            pass
    return None


def classify_tag(title: str, category: str = "") -> str:
    t = (title + " " + category).lower()
    if any(w in t for w in ["приказ", "постановление", "федеральный закон", "гост", "норматив", "правила"]):
        return "Норматив"
    if any(w in t for w in ["разъяснение", "письмо", "разъяснил", "ответил", "вопрос"]):
        return "Разъяснение"
    if any(w in t for w in ["проверка", "инспекция", "гит", "роструд", "штраф", "нарушени"]):
        return "Надзор"
    if any(w in t for w in ["форум", "конференция", "неделя", "внот", "семинар"]):
        return "Мероприятие"
    return "Новость"


# ─── Кэш в БД ─────────────────────────────────────────────────────────────────
def get_cached_news(conn) -> list[dict] | None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT tag, title, description, url, published_at::text
            FROM {SCHEMA}.news_cache
            WHERE fetched_at::date = CURRENT_DATE
            ORDER BY published_at DESC NULLS LAST, id DESC
            LIMIT 20
            """,
        )
        rows = cur.fetchall()
    if not rows:
        return None
    return [
        {"tag": r[0], "title": r[1], "description": r[2] or "", "url": r[3], "date": format_date_ru(r[4])}
        for r in rows
    ]


def save_news_to_cache(conn, items: list[dict]):
    with conn.cursor() as cur:
        cur.execute(
            f"DELETE FROM {SCHEMA}.news_cache WHERE fetched_at::date = CURRENT_DATE"
        )
        for item in items:
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.news_cache (tag, title, description, url, published_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (item["tag"], item["title"], item.get("description"),
                 item.get("url"), item.get("published_at")),
            )
    conn.commit()


def format_date_ru(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        d = datetime.strptime(iso[:10], "%Y-%m-%d")
        months = ["", "января", "февраля", "марта", "апреля", "мая", "июня",
                  "июля", "августа", "сентября", "октября", "ноября", "декабря"]
        return f"{d.day} {months[d.month]} {d.year}"
    except Exception:
        return iso


# ─── Handler ──────────────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    """Возвращает актуальные новости Минтруда по охране труда из RSS."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        cached = get_cached_news(conn)
        if cached:
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"news": cached, "source": "cache"}, ensure_ascii=False),
            }

        items = parse_rss()

        if items:
            save_news_to_cache(conn, items)
            news_out = [
                {
                    "tag": it["tag"],
                    "title": it["title"],
                    "description": it.get("description") or "",
                    "url": it.get("url") or "",
                    "date": format_date_ru(it.get("published_at")),
                }
                for it in items
            ]
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"news": news_out, "source": "live"}, ensure_ascii=False),
            }

        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(
                {"news": [], "source": "empty", "message": "Новости временно недоступны"},
                ensure_ascii=False,
            ),
        }

    finally:
        conn.close()

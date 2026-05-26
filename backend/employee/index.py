"""
Сотрудник: уведомления, назначенные тесты, отправка результата.
Роутинг через ?action=notifications|read|assigned|complete
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Cookie",
}
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")


def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}


def get_session_id(event):
    cookie_header = event.get("headers", {}).get("X-Cookie", "")
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith("session_id="):
            return part[len("session_id="):]
    return None


def get_user(cur, sid):
    if not sid:
        return None
    cur.execute(
        f"""SELECT u.id, u.fio, u.email, u.role, u.company_id
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.id = %s AND s.expires_at > NOW()""",
        (sid,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "fio": row[1], "email": row[2],
            "role": row[3], "company_id": row[4]}


def handler(event: dict, context) -> dict:
    """Панель сотрудника. Параметр: ?action=notifications|read|assigned|complete"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    try:
        user = get_user(cur, get_session_id(event))
        if not user:
            return err("Не авторизован", 401)

        # ?action=notifications
        if action == "notifications":
            cur.execute(
                f"""SELECT id, title, body, is_read, created_at::text
                    FROM {SCHEMA}.notifications
                    WHERE user_id = %s ORDER BY created_at DESC LIMIT 50""",
                (user["id"],),
            )
            notifs = [{"id": r[0], "title": r[1], "body": r[2],
                       "is_read": r[3], "created_at": r[4]}
                      for r in cur.fetchall()]
            return ok({"notifications": notifs})

        # ?action=read
        if action == "read":
            cur.execute(
                f"UPDATE {SCHEMA}.notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
                (user["id"],),
            )
            conn.commit()
            return ok({"ok": True})

        # ?action=assigned
        if action == "assigned":
            cur.execute(
                f"""SELECT at.id, at.test_id, at.test_title, at.assigned_at::text,
                        at.due_date::text, at.completed_at::text, at.score,
                        u.fio as employer_fio
                    FROM {SCHEMA}.assigned_tests at
                    JOIN {SCHEMA}.users u ON u.id = at.employer_id
                    WHERE at.employee_id = %s
                    ORDER BY at.assigned_at DESC""",
                (user["id"],),
            )
            tests = [{"id": r[0], "test_id": r[1], "test_title": r[2], "assigned_at": r[3],
                      "due_date": r[4], "completed_at": r[5], "score": r[6],
                      "employer_fio": r[7]}
                     for r in cur.fetchall()]
            return ok({"tests": tests})

        # ?action=complete
        if action == "complete":
            body = json.loads(event.get("body") or "{}")
            test_id = body.get("test_id")
            score = body.get("score")
            if not test_id or score is None:
                return err("Укажите test_id и score")
            cur.execute(
                f"""UPDATE {SCHEMA}.assigned_tests
                    SET completed_at = NOW(), score = %s
                    WHERE employee_id = %s AND test_id = %s""",
                (int(score), user["id"], test_id),
            )
            conn.commit()
            return ok({"ok": True})

        return err(f"Неизвестное действие: '{action}'", 400)

    finally:
        cur.close()
        conn.close()

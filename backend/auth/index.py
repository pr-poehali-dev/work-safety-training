"""
Аутентификация: регистрация, вход, выход, профиль, список компаний.
"""
import json
import os
import hashlib
import secrets
import psycopg2
from datetime import datetime, timedelta

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Cookie, X-Authorization",
}
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")

def ok(data: dict, cookie: str = None):
    headers = {**CORS, "Content-Type": "application/json"}
    if cookie:
        headers["X-Set-Cookie"] = cookie
    return {"statusCode": 200, "headers": headers, "body": json.dumps(data, ensure_ascii=False)}

def err(msg: str, code: int = 400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_session_id(event: dict) -> str | None:
    cookie_header = event.get("headers", {}).get("X-Cookie", "")
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith("session_id="):
            return part[len("session_id="):]
    return None

def handler(event: dict, context) -> dict:
    """Регистрация, вход, выход, профиль пользователя."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    path = event.get("path", "/").rstrip("/") or "/"
    method = event.get("httpMethod", "GET")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    try:
        # GET /companies
        if method == "GET" and path.endswith("companies"):
            cur.execute(f"SELECT id, name FROM {SCHEMA}.companies ORDER BY name")
            companies = [{"id": r[0], "name": r[1]} for r in cur.fetchall()]
            return ok({"companies": companies})

        # GET /me
        if method == "GET" and path.endswith("me"):
            sid = get_session_id(event)
            if not sid:
                return err("Не авторизован", 401)
            cur.execute(
                f"""SELECT u.id, u.fio, u.email, u.role, u.company_id, u.phone, c.name
                    FROM {SCHEMA}.sessions s
                    JOIN {SCHEMA}.users u ON u.id = s.user_id
                    LEFT JOIN {SCHEMA}.companies c ON c.id = u.company_id
                    WHERE s.id = %s AND s.expires_at > NOW()""",
                (sid,)
            )
            row = cur.fetchone()
            if not row:
                return err("Сессия истекла", 401)
            return ok({"user": {
                "id": row[0], "fio": row[1], "email": row[2],
                "role": row[3], "company_id": row[4], "phone": row[5],
                "company_name": row[6],
            }})

        body = json.loads(event.get("body") or "{}")

        # POST /register
        if method == "POST" and path.endswith("register"):
            fio = (body.get("fio") or "").strip()
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            role = body.get("role") or ""
            phone = (body.get("phone") or "").strip() or None
            company_name = (body.get("company_name") or "").strip()
            company_id = body.get("company_id")

            if not fio or not email or not password or role not in ("employer", "employee"):
                return err("Заполните все обязательные поля")
            if len(password) < 6:
                return err("Пароль должен быть не менее 6 символов")

            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
            if cur.fetchone():
                return err("Пользователь с таким email уже зарегистрирован")

            if role == "employer":
                if not company_name:
                    return err("Укажите название компании")
                cur.execute(f"INSERT INTO {SCHEMA}.companies (name) VALUES (%s) RETURNING id", (company_name,))
                company_id = cur.fetchone()[0]
            else:
                if not company_id:
                    return err("Выберите компанию")
                cur.execute(f"SELECT id FROM {SCHEMA}.companies WHERE id = %s", (int(company_id),))
                if not cur.fetchone():
                    return err("Компания не найдена")

            cur.execute(
                f"""INSERT INTO {SCHEMA}.users (fio, email, password_hash, role, company_id, phone)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (fio, email, hash_pw(password), role, company_id, phone)
            )
            user_id = cur.fetchone()[0]

            sid = secrets.token_hex(32)
            expires = datetime.now() + timedelta(days=30)
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (id, user_id, expires_at) VALUES (%s, %s, %s)",
                (sid, user_id, expires)
            )
            conn.commit()

            cur.execute(f"SELECT name FROM {SCHEMA}.companies WHERE id = %s", (company_id,))
            cname = cur.fetchone()[0]
            cookie = f"session_id={sid}; Path=/; Max-Age=2592000; SameSite=Lax"
            return ok({"user": {
                "id": user_id, "fio": fio, "email": email,
                "role": role, "company_id": company_id, "company_name": cname, "phone": phone,
            }}, cookie)

        # POST /login
        if method == "POST" and path.endswith("login"):
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            cur.execute(
                f"""SELECT u.id, u.fio, u.email, u.role, u.company_id, u.phone, c.name
                    FROM {SCHEMA}.users u
                    LEFT JOIN {SCHEMA}.companies c ON c.id = u.company_id
                    WHERE u.email = %s AND u.password_hash = %s""",
                (email, hash_pw(password))
            )
            row = cur.fetchone()
            if not row:
                return err("Неверный email или пароль")

            sid = secrets.token_hex(32)
            expires = datetime.now() + timedelta(days=30)
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (id, user_id, expires_at) VALUES (%s, %s, %s)",
                (sid, row[0], expires)
            )
            conn.commit()
            cookie = f"session_id={sid}; Path=/; Max-Age=2592000; SameSite=Lax"
            return ok({"user": {
                "id": row[0], "fio": row[1], "email": row[2],
                "role": row[3], "company_id": row[4], "phone": row[5],
                "company_name": row[6],
            }}, cookie)

        # POST /logout
        if method == "POST" and path.endswith("logout"):
            sid = get_session_id(event)
            if sid:
                cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE id = %s", (sid,))
                conn.commit()
            cookie = "session_id=; Path=/; Max-Age=0"
            return ok({"ok": True}, cookie)

        return err("Not found", 404)

    finally:
        cur.close()
        conn.close()

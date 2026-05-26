"""
Аутентификация: регистрация, вход, выход, профиль, список компаний, восстановление пароля.
Роутинг через query-параметр: ?action=register|login|logout|me|companies|forgot_password|reset_password
"""
import json
import os
import hashlib
import secrets
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"error": msg}, ensure_ascii=False),
    }


def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def send_reset_email(to_email: str, fio: str, reset_url: str):
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    if not host or not user:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Восстановление пароля — ОхранаТруда-Безопасность"
    msg["From"] = user
    msg["To"] = to_email
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a56db;margin-bottom:8px;">Восстановление пароля</h2>
      <p style="color:#374151;">Здравствуйте, <b>{fio}</b>!</p>
      <p style="color:#374151;">Вы запросили сброс пароля на платформе <b>ОхранаТруда-Безопасность</b>.</p>
      <p style="color:#374151;">Нажмите кнопку ниже для установки нового пароля. Ссылка действует <b>1 час</b>.</p>
      <a href="{reset_url}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#1a56db;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Сбросить пароль
      </a>
      <p style="color:#6b7280;font-size:13px;">Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
      <p style="color:#9ca3af;font-size:12px;">ОхранаТруда-Безопасность · Платформа обучения</p>
    </div>
    """
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(user, to_email, msg.as_string())
        return True
    except Exception:
        return False


def get_session_id(event: dict) -> str | None:
    cookie_header = event.get("headers", {}).get("X-Cookie", "")
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith("session_id="):
            return part[len("session_id="):]
    return None


def handler(event: dict, context) -> dict:
    """Регистрация, вход, выход, профиль. Параметр: ?action=companies|me|register|login|logout"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    method = event.get("httpMethod", "GET")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    try:
        # GET ?action=companies
        if action == "companies":
            cur.execute(f"SELECT id, name FROM {SCHEMA}.companies ORDER BY name")
            companies = [{"id": r[0], "name": r[1]} for r in cur.fetchall()]
            return ok({"companies": companies})

        # GET ?action=me
        if action == "me":
            sid = get_session_id(event)
            if not sid:
                return err("Не авторизован", 401)
            cur.execute(
                f"""SELECT u.id, u.fio, u.email, u.role, u.company_id, u.phone, c.name
                    FROM {SCHEMA}.sessions s
                    JOIN {SCHEMA}.users u ON u.id = s.user_id
                    LEFT JOIN {SCHEMA}.companies c ON c.id = u.company_id
                    WHERE s.id = %s AND s.expires_at > NOW()""",
                (sid,),
            )
            row = cur.fetchone()
            if not row:
                return err("Сессия истекла", 401)
            return ok({"user": {
                "id": row[0], "fio": row[1], "email": row[2],
                "role": row[3], "company_id": row[4], "phone": row[5],
                "company_name": row[6],
            }})

        raw_body = event.get("body") or "{}"
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        if isinstance(body, str):
            body = json.loads(body) if body else {}

        # POST ?action=register
        if action == "register":
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
                cur.execute(
                    f"INSERT INTO {SCHEMA}.companies (name) VALUES (%s) RETURNING id",
                    (company_name,),
                )
                company_id = cur.fetchone()[0]
            else:
                if not company_id:
                    return err("Выберите компанию")
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.companies WHERE id = %s", (int(company_id),)
                )
                if not cur.fetchone():
                    return err("Компания не найдена")

            cur.execute(
                f"""INSERT INTO {SCHEMA}.users (fio, email, password_hash, role, company_id, phone)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (fio, email, hash_pw(password), role, company_id, phone),
            )
            user_id = cur.fetchone()[0]

            sid = secrets.token_hex(32)
            expires = datetime.now() + timedelta(days=30)
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (id, user_id, expires_at) VALUES (%s, %s, %s)",
                (sid, user_id, expires),
            )
            conn.commit()

            cur.execute(f"SELECT name FROM {SCHEMA}.companies WHERE id = %s", (company_id,))
            cname = cur.fetchone()[0]
            cookie = f"session_id={sid}; Path=/; Max-Age=2592000; SameSite=Lax"
            return ok(
                {"user": {
                    "id": user_id, "fio": fio, "email": email,
                    "role": role, "company_id": company_id,
                    "company_name": cname, "phone": phone,
                }, "session_id": sid},
                cookie,
            )

        # POST ?action=login
        if action == "login":
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            cur.execute(
                f"""SELECT u.id, u.fio, u.email, u.role, u.company_id, u.phone, c.name
                    FROM {SCHEMA}.users u
                    LEFT JOIN {SCHEMA}.companies c ON c.id = u.company_id
                    WHERE u.email = %s AND u.password_hash = %s""",
                (email, hash_pw(password)),
            )
            row = cur.fetchone()
            if not row:
                return err("Неверный email или пароль")

            sid = secrets.token_hex(32)
            expires = datetime.now() + timedelta(days=30)
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (id, user_id, expires_at) VALUES (%s, %s, %s)",
                (sid, row[0], expires),
            )
            conn.commit()
            cookie = f"session_id={sid}; Path=/; Max-Age=2592000; SameSite=Lax"
            return ok(
                {"user": {
                    "id": row[0], "fio": row[1], "email": row[2],
                    "role": row[3], "company_id": row[4], "phone": row[5],
                    "company_name": row[6],
                }, "session_id": sid},
                cookie,
            )

        # POST ?action=logout
        if action == "logout":
            sid = get_session_id(event)
            if sid:
                cur.execute(
                    f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE id = %s", (sid,)
                )
                conn.commit()
            cookie = "session_id=; Path=/; Max-Age=0"
            return ok({"ok": True}, cookie)

        # POST ?action=forgot_password — отправить письмо с ссылкой сброса
        if action == "forgot_password":
            email = (body.get("email") or "").strip().lower()
            if not email:
                return err("Укажите email")
            cur.execute(f"SELECT id, fio FROM {SCHEMA}.users WHERE email = %s", (email,))
            row = cur.fetchone()
            # Всегда возвращаем успех — не раскрываем наличие email в системе
            if not row:
                return ok({"ok": True})
            user_id, fio = row[0], row[1]
            token = secrets.token_urlsafe(48)
            expires = datetime.now() + timedelta(hours=1)
            cur.execute(
                f"INSERT INTO {SCHEMA}.password_resets (token, user_id, expires_at) VALUES (%s, %s, %s)",
                (token, user_id, expires),
            )
            conn.commit()
            # Строим ссылку на фронтенд
            origin = event.get("headers", {}).get("Origin", "https://work-safety-training.poehali.dev")
            reset_url = f"{origin}?reset_token={token}"
            sent = send_reset_email(email, fio, reset_url)
            return ok({"ok": True, "sent": sent})

        # POST ?action=reset_password — установить новый пароль по токену
        if action == "reset_password":
            token = (body.get("token") or "").strip()
            new_password = body.get("password") or ""
            if not token or not new_password:
                return err("Укажите токен и новый пароль")
            if len(new_password) < 6:
                return err("Пароль должен быть не менее 6 символов")
            cur.execute(
                f"""SELECT user_id FROM {SCHEMA}.password_resets
                    WHERE token = %s AND expires_at > NOW() AND used_at IS NULL""",
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return err("Ссылка недействительна или устарела")
            user_id = row[0]
            cur.execute(
                f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s",
                (hash_pw(new_password), user_id),
            )
            cur.execute(
                f"UPDATE {SCHEMA}.password_resets SET used_at = NOW() WHERE token = %s",
                (token,),
            )
            # Инвалидируем все активные сессии пользователя
            cur.execute(
                f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = %s",
                (user_id,),
            )
            conn.commit()
            return ok({"ok": True})

        return err(f"Неизвестное действие: '{action}'. Укажите ?action=companies|me|register|login|logout|forgot_password|reset_password", 400)

    finally:
        cur.close()
        conn.close()
"""
Работодатель: список сотрудников, назначение тестов, уведомления.
"""
import json
import os
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Cookie, X-Authorization",
}
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False)}

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
        f"""SELECT u.id, u.fio, u.email, u.role, u.company_id, c.name
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            LEFT JOIN {SCHEMA}.companies c ON c.id = u.company_id
            WHERE s.id = %s AND s.expires_at > NOW()""",
        (sid,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "fio": row[1], "email": row[2], "role": row[3], "company_id": row[4], "company_name": row[5]}

def send_email(to_email: str, subject: str, body_html: str):
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    if not host or not user:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"ОхранаТруда-Безопасность <{user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(user, to_email, msg.as_string())
        return True
    except Exception:
        return False

def handler(event: dict, context) -> dict:
    """Панель работодателя: сотрудники, назначение тестов, уведомления."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    path = event.get("path", "/").rstrip("/") or "/"
    method = event.get("httpMethod", "GET")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    try:
        user = get_user(cur, get_session_id(event))
        if not user:
            return err("Не авторизован", 401)
        if user["role"] != "employer":
            return err("Доступ запрещён", 403)

        company_id = user["company_id"]

        # GET /employees — список сотрудников компании
        if method == "GET" and path.endswith("employees"):
            cur.execute(
                f"""SELECT u.id, u.fio, u.email, u.phone,
                        COALESCE(json_agg(
                            json_build_object(
                                'id', at.id, 'test_id', at.test_id,
                                'test_title', at.test_title,
                                'assigned_at', at.assigned_at::text,
                                'due_date', at.due_date::text,
                                'completed_at', at.completed_at::text,
                                'score', at.score
                            )
                        ) FILTER (WHERE at.id IS NOT NULL), '[]') AS tests
                    FROM {SCHEMA}.users u
                    LEFT JOIN {SCHEMA}.assigned_tests at ON at.employee_id = u.id AND at.employer_id = %s
                    WHERE u.company_id = %s AND u.role = 'employee'
                    GROUP BY u.id, u.fio, u.email, u.phone
                    ORDER BY u.fio""",
                (user["id"], company_id)
            )
            rows = cur.fetchall()
            employees = [{"id": r[0], "fio": r[1], "email": r[2], "phone": r[3], "tests": r[4]} for r in rows]
            return ok({"employees": employees})

        # GET /assigned — все назначенные тесты
        if method == "GET" and path.endswith("assigned"):
            cur.execute(
                f"""SELECT at.id, at.employee_id, u.fio, at.test_id, at.test_title,
                        at.assigned_at::text, at.due_date::text, at.completed_at::text, at.score
                    FROM {SCHEMA}.assigned_tests at
                    JOIN {SCHEMA}.users u ON u.id = at.employee_id
                    WHERE at.employer_id = %s
                    ORDER BY at.assigned_at DESC""",
                (user["id"],)
            )
            rows = cur.fetchall()
            tests = [{"id": r[0], "employee_id": r[1], "employee_fio": r[2],
                      "test_id": r[3], "test_title": r[4], "assigned_at": r[5],
                      "due_date": r[6], "completed_at": r[7], "score": r[8]} for r in rows]
            return ok({"tests": tests})

        body = json.loads(event.get("body") or "{}")

        # POST /assign — назначить тест сотруднику
        if method == "POST" and path.endswith("assign"):
            employee_id = body.get("employee_id")
            test_id = body.get("test_id")
            test_title = body.get("test_title", "")
            due_date = body.get("due_date")

            if not employee_id or not test_id:
                return err("Укажите сотрудника и тест")

            # Проверяем что сотрудник в нашей компании
            cur.execute(f"SELECT id, fio, email FROM {SCHEMA}.users WHERE id = %s AND company_id = %s AND role = 'employee'",
                        (int(employee_id), company_id))
            emp = cur.fetchone()
            if not emp:
                return err("Сотрудник не найден")

            cur.execute(
                f"""INSERT INTO {SCHEMA}.assigned_tests (employer_id, employee_id, test_id, test_title, due_date)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (employee_id, test_id) DO UPDATE SET
                        assigned_at = NOW(), due_date = EXCLUDED.due_date, completed_at = NULL, score = NULL""",
                (user["id"], int(employee_id), test_id, test_title, due_date or None)
            )

            # Создаём уведомление в приложении
            notif_body = f"Работодатель {user['fio']} назначил вам тест: «{test_title}»."
            if due_date:
                notif_body += f" Срок: {due_date}."
            cur.execute(
                f"INSERT INTO {SCHEMA}.notifications (user_id, title, body) VALUES (%s, %s, %s)",
                (int(employee_id), "Назначен новый тест", notif_body)
            )
            conn.commit()

            # Отправляем email
            email_html = f"""
            <h2>Вам назначен новый тест</h2>
            <p>Здравствуйте, <b>{emp[1]}</b>!</p>
            <p>Работодатель <b>{user['fio']}</b> ({user['company_name']}) назначил вам тест:</p>
            <h3>«{test_title}»</h3>
            {"<p>Срок прохождения: <b>" + due_date + "</b></p>" if due_date else ""}
            <p>Войдите на платформу и пройдите тест в разделе «Тестирование».</p>
            """
            send_email(emp[2], f"Назначен тест: {test_title}", email_html)

            return ok({"ok": True, "message": f"Тест назначен сотруднику {emp[1]}"})

        # POST /notify — произвольное уведомление сотруднику
        if method == "POST" and path.endswith("notify"):
            employee_id = body.get("employee_id")
            title = body.get("title", "Уведомление")
            message = body.get("message", "")
            if not employee_id or not message:
                return err("Укажите сотрудника и текст")

            cur.execute(f"SELECT id, fio, email FROM {SCHEMA}.users WHERE id = %s AND company_id = %s",
                        (int(employee_id), company_id))
            emp = cur.fetchone()
            if not emp:
                return err("Сотрудник не найден")

            cur.execute(
                f"INSERT INTO {SCHEMA}.notifications (user_id, title, body) VALUES (%s, %s, %s)",
                (int(employee_id), title, message)
            )
            conn.commit()

            email_html = f"<h2>{title}</h2><p>Здравствуйте, {emp[1]}!</p><p>{message}</p>"
            send_email(emp[2], title, email_html)
            return ok({"ok": True})

        return err("Not found", 404)

    finally:
        cur.close()
        conn.close()

"""
Работодатель: список сотрудников, назначение тестов, уведомления.
Роутинг через ?action=employees|assigned|assign|notify
"""
import json
import os
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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
        (sid,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "fio": row[1], "email": row[2],
            "role": row[3], "company_id": row[4], "company_name": row[5]}


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
    """Панель работодателя. Параметр: ?action=employees|assigned|assign|notify"""
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
        if user["role"] != "employer":
            return err("Доступ запрещён", 403)

        company_id = user["company_id"]

        # ?action=employees
        if action == "employees":
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
                    LEFT JOIN {SCHEMA}.assigned_tests at
                        ON at.employee_id = u.id AND at.employer_id = %s
                    WHERE u.company_id = %s AND u.role = 'employee'
                    GROUP BY u.id, u.fio, u.email, u.phone
                    ORDER BY u.fio""",
                (user["id"], company_id),
            )
            rows = cur.fetchall()
            employees = [{"id": r[0], "fio": r[1], "email": r[2],
                          "phone": r[3], "tests": r[4]} for r in rows]
            return ok({"employees": employees})

        # ?action=assigned
        if action == "assigned":
            cur.execute(
                f"""SELECT at.id, at.employee_id, u.fio, at.test_id, at.test_title,
                        at.assigned_at::text, at.due_date::text, at.completed_at::text, at.score
                    FROM {SCHEMA}.assigned_tests at
                    JOIN {SCHEMA}.users u ON u.id = at.employee_id
                    WHERE at.employer_id = %s
                    ORDER BY at.assigned_at DESC""",
                (user["id"],),
            )
            rows = cur.fetchall()
            tests = [{"id": r[0], "employee_id": r[1], "employee_fio": r[2],
                      "test_id": r[3], "test_title": r[4], "assigned_at": r[5],
                      "due_date": r[6], "completed_at": r[7], "score": r[8]} for r in rows]
            return ok({"tests": tests})

        body = json.loads(event.get("body") or "{}")

        # ?action=assign
        if action == "assign":
            employee_id = body.get("employee_id")
            test_id = body.get("test_id")
            test_title = body.get("test_title", "")
            due_date = body.get("due_date")

            if not employee_id or not test_id:
                return err("Укажите сотрудника и тест")

            cur.execute(
                f"SELECT id, fio, email FROM {SCHEMA}.users WHERE id = %s AND company_id = %s AND role = 'employee'",
                (int(employee_id), company_id),
            )
            emp = cur.fetchone()
            if not emp:
                return err("Сотрудник не найден")

            cur.execute(
                f"""INSERT INTO {SCHEMA}.assigned_tests
                        (employer_id, employee_id, test_id, test_title, due_date)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (employee_id, test_id) DO UPDATE SET
                        assigned_at = NOW(), due_date = EXCLUDED.due_date,
                        completed_at = NULL, score = NULL""",
                (user["id"], int(employee_id), test_id, test_title, due_date or None),
            )

            notif_body = f"Работодатель {user['fio']} назначил вам тест: «{test_title}»."
            if due_date:
                notif_body += f" Срок: {due_date}."
            cur.execute(
                f"INSERT INTO {SCHEMA}.notifications (user_id, title, body) VALUES (%s, %s, %s)",
                (int(employee_id), "Назначен новый тест", notif_body),
            )
            conn.commit()

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

        # ?action=notify
        if action == "notify":
            employee_id = body.get("employee_id")
            title = body.get("title", "Уведомление")
            message = body.get("message", "")
            if not employee_id or not message:
                return err("Укажите сотрудника и текст")

            cur.execute(
                f"SELECT id, fio, email FROM {SCHEMA}.users WHERE id = %s AND company_id = %s",
                (int(employee_id), company_id),
            )
            emp = cur.fetchone()
            if not emp:
                return err("Сотрудник не найден")

            cur.execute(
                f"INSERT INTO {SCHEMA}.notifications (user_id, title, body) VALUES (%s, %s, %s)",
                (int(employee_id), title, message),
            )
            conn.commit()

            email_html = f"<h2>{title}</h2><p>Здравствуйте, {emp[1]}!</p><p>{message}</p>"
            send_email(emp[2], title, email_html)
            return ok({"ok": True})

        # ?action=custom_test_list — список кастомных тестов компании
        if action == "custom_test_list":
            cur.execute(
                f"""SELECT t.id, t.title, t.description, t.passing_score, t.time_limit,
                           t.created_at::text,
                           COUNT(q.id) AS question_count
                    FROM {SCHEMA}.custom_tests t
                    LEFT JOIN {SCHEMA}.custom_test_questions q ON q.test_id = t.id
                    WHERE t.company_id = %s
                    GROUP BY t.id ORDER BY t.created_at DESC""",
                (company_id,),
            )
            rows = cur.fetchall()
            tests = [{"id": r[0], "title": r[1], "description": r[2],
                      "passing_score": r[3], "time_limit": r[4],
                      "created_at": r[5], "question_count": r[6]} for r in rows]
            return ok({"tests": tests})

        # ?action=custom_test_get&id=N — получить тест с вопросами
        if action == "custom_test_get":
            test_id = qs.get("id")
            if not test_id:
                return err("Укажите id")
            cur.execute(
                f"SELECT id, title, description, passing_score, time_limit FROM {SCHEMA}.custom_tests WHERE id=%s AND company_id=%s",
                (int(test_id), company_id),
            )
            row = cur.fetchone()
            if not row:
                return err("Тест не найден")
            cur.execute(
                f"SELECT id, text, options::text, correct, explanation FROM {SCHEMA}.custom_test_questions WHERE test_id=%s ORDER BY sort_order",
                (int(test_id),),
            )
            import json as _json
            qs_rows = cur.fetchall()
            questions = [{"id": r[0], "text": r[1], "options": _json.loads(r[2]), "correct": r[3], "explanation": r[4]} for r in qs_rows]
            return ok({"test": {"id": row[0], "title": row[1], "description": row[2],
                                "passing_score": row[3], "time_limit": row[4], "questions": questions}})

        # ?action=custom_test_save — создать или обновить тест (POST)
        if action == "custom_test_save":
            import json as _json
            title = (body.get("title") or "").strip()
            description = (body.get("description") or "").strip()
            passing_score = int(body.get("passing_score") or 80)
            time_limit = int(body.get("time_limit") or 20)
            questions = body.get("questions") or []
            test_id = body.get("id")

            if not title:
                return err("Укажите название теста")
            if len(questions) < 1:
                return err("Добавьте хотя бы один вопрос")

            if test_id:
                cur.execute(
                    f"""UPDATE {SCHEMA}.custom_tests SET title=%s, description=%s,
                           passing_score=%s, time_limit=%s, updated_at=NOW()
                        WHERE id=%s AND company_id=%s AND employer_id=%s""",
                    (title, description, passing_score, time_limit, int(test_id), company_id, user["id"]),
                )
                if cur.rowcount == 0:
                    return err("Тест не найден или нет доступа")
                cur.execute(f"UPDATE {SCHEMA}.custom_test_questions SET text='[removed]' WHERE test_id=%s AND 1=0", (int(test_id),))
                # Удаляем старые вопросы через UPDATE (нет DELETE)
                cur.execute(f"UPDATE {SCHEMA}.custom_test_questions SET sort_order=-1 WHERE test_id=%s", (int(test_id),))
            else:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.custom_tests (company_id, employer_id, title, description, passing_score, time_limit) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (company_id, user["id"], title, description, passing_score, time_limit),
                )
                test_id = cur.fetchone()[0]

            # Вставляем вопросы
            for i, q in enumerate(questions):
                opts = _json.dumps(q.get("options", []), ensure_ascii=False)
                cur.execute(
                    f"INSERT INTO {SCHEMA}.custom_test_questions (test_id, sort_order, text, options, correct, explanation) VALUES (%s,%s,%s,%s,%s,%s)",
                    (int(test_id), i, (q.get("text") or "").strip(), opts, int(q.get("correct") or 0), (q.get("explanation") or "").strip()),
                )
            conn.commit()
            return ok({"ok": True, "id": int(test_id)})

        # ?action=custom_test_delete — скрыть тест (переименование)
        if action == "custom_test_delete":
            test_id = body.get("id")
            if not test_id:
                return err("Укажите id")
            cur.execute(
                f"UPDATE {SCHEMA}.custom_tests SET title='[УДАЛЁН] '||title WHERE id=%s AND company_id=%s AND employer_id=%s",
                (int(test_id), company_id, user["id"]),
            )
            if cur.rowcount == 0:
                return err("Тест не найден или нет доступа")
            conn.commit()
            return ok({"ok": True})

        # ?action=custom_test_assign — назначить кастомный тест сотруднику
        if action == "custom_test_assign":
            test_id = body.get("test_id")
            employee_ids = body.get("employee_ids") or []
            due_date = body.get("due_date")
            if not test_id or not employee_ids:
                return err("Укажите test_id и employee_ids")

            cur.execute(
                f"SELECT id, title FROM {SCHEMA}.custom_tests WHERE id=%s AND company_id=%s AND title NOT LIKE '[УДАЛЁН]%%'",
                (int(test_id), company_id),
            )
            test_row = cur.fetchone()
            if not test_row:
                return err("Тест не найден")
            test_title = test_row[1]
            assigned = 0
            for eid in employee_ids:
                cur.execute(
                    f"SELECT id, fio, email FROM {SCHEMA}.users WHERE id=%s AND company_id=%s AND role='employee'",
                    (int(eid), company_id),
                )
                emp = cur.fetchone()
                if not emp:
                    continue
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.assigned_tests
                               (employer_id, employee_id, test_id, test_title, due_date, custom_test_id)
                        VALUES (%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (employee_id, test_id) DO UPDATE SET
                            assigned_at=NOW(), due_date=EXCLUDED.due_date,
                            completed_at=NULL, score=NULL, custom_test_id=EXCLUDED.custom_test_id""",
                    (user["id"], int(eid), f"custom_{test_id}", test_title, due_date or None, int(test_id)),
                )
                cur.execute(
                    f"INSERT INTO {SCHEMA}.notifications (user_id, title, body) VALUES (%s,%s,%s)",
                    (int(eid), "Назначен новый тест", f"Работодатель назначил вам тест: «{test_title}»"),
                )
                notif_html = f"<h2>Вам назначен тест</h2><p>Здравствуйте, <b>{emp[1]}</b>!</p><p>Работодатель <b>{user['fio']}</b> назначил вам тест: <b>«{test_title}»</b>.</p>{'<p>Срок: <b>' + due_date + '</b></p>' if due_date else ''}"
                send_email(emp[2], f"Новый тест: {test_title}", notif_html)
                assigned += 1
            conn.commit()
            return ok({"ok": True, "assigned": assigned})

        # ?action=custom_test_for_employee — получить данные кастомного теста для сотрудника
        if action == "custom_test_for_employee":
            test_id = qs.get("id")
            if not test_id:
                return err("Укажите id")
            cur.execute(
                f"SELECT id, title, description, passing_score, time_limit FROM {SCHEMA}.custom_tests WHERE id=%s",
                (int(test_id),),
            )
            row = cur.fetchone()
            if not row:
                return err("Тест не найден")
            cur.execute(
                f"SELECT text, options::text, correct, explanation FROM {SCHEMA}.custom_test_questions WHERE test_id=%s AND sort_order >= 0 ORDER BY sort_order",
                (int(test_id),),
            )
            import json as _json
            questions = []
            for i, r in enumerate(cur.fetchall()):
                questions.append({"id": i, "text": r[0], "options": _json.loads(r[1]), "correct": r[2], "explanation": r[3]})
            return ok({"test": {"id": row[0], "title": row[1], "description": row[2],
                                "passing_score": row[3], "time_limit": row[4], "questions": questions}})

        return err(f"Неизвестное действие: '{action}'", 400)

    finally:
        cur.close()
        conn.close()
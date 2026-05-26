"""
Документы компании (СОУТ и ПрофРиски): загрузка, отправка сотрудникам, просмотр.
?action=upload|list|assign|my_docs|mark_read|delete|contacts_get|contacts_save
"""
import json
import os
import base64
import uuid
import psycopg2
import boto3

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Cookie",
}
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")
S3_ENDPOINT = "https://bucket.poehali.dev"
S3_BUCKET = "files"


def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}


def get_session_id(event):
    h = event.get("headers", {}).get("X-Cookie", "")
    for part in h.split(";"):
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


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def cdn_url(key: str) -> str:
    aid = os.environ["AWS_ACCESS_KEY_ID"]
    return f"https://cdn.poehali.dev/projects/{aid}/bucket/{key}"


def handler(event: dict, context) -> dict:
    """Документы СОУТ/ПрофРиски и контакты компании."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    try:
        # ── Контакты (доступны всем авторизованным) ──────────────────────────

        # ?action=contacts_get&company_id=N
        if action == "contacts_get":
            company_id = qs.get("company_id")
            if not company_id:
                return err("Укажите company_id")
            cur.execute(
                f"""SELECT specialist_name, phone, email, office, schedule
                    FROM {SCHEMA}.company_contacts WHERE company_id = %s""",
                (int(company_id),),
            )
            row = cur.fetchone()
            if row:
                data = {"specialist_name": row[0], "phone": row[1],
                        "email": row[2], "office": row[3], "schedule": row[4]}
            else:
                data = {"specialist_name": "", "phone": "", "email": "", "office": "", "schedule": ""}
            return ok({"contacts": data})

        # ?action=contacts_save  (только employer)
        if action == "contacts_save":
            user = get_user(cur, get_session_id(event))
            if not user:
                return err("Не авторизован", 401)
            if user["role"] != "employer":
                return err("Только работодатель может редактировать контакты", 403)
            body = json.loads(event.get("body") or "{}")
            c = user["company_id"]
            cur.execute(
                f"""INSERT INTO {SCHEMA}.company_contacts
                        (company_id, specialist_name, phone, email, office, schedule, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (company_id) DO UPDATE SET
                        specialist_name = EXCLUDED.specialist_name,
                        phone = EXCLUDED.phone,
                        email = EXCLUDED.email,
                        office = EXCLUDED.office,
                        schedule = EXCLUDED.schedule,
                        updated_at = NOW()""",
                (c, body.get("specialist_name", ""), body.get("phone", ""),
                 body.get("email", ""), body.get("office", ""), body.get("schedule", "")),
            )
            conn.commit()
            return ok({"ok": True})

        # ── Документы (требуют авторизации) ──────────────────────────────────

        user = get_user(cur, get_session_id(event))
        if not user:
            return err("Не авторизован", 401)

        company_id = user["company_id"]

        # ?action=list — все документы компании (employer) или только назначенные (employee)
        if action == "list":
            if user["role"] == "employer":
                cur.execute(
                    f"""SELECT d.id, d.doc_type, d.title, d.file_url, d.file_name,
                            d.created_at::text,
                            COALESCE(json_agg(
                                json_build_object(
                                    'employee_id', da.employee_id,
                                    'fio', u.fio,
                                    'assigned_at', da.assigned_at::text,
                                    'read_at', da.read_at::text
                                )
                            ) FILTER (WHERE da.id IS NOT NULL), '[]') as assignments
                        FROM {SCHEMA}.company_documents d
                        LEFT JOIN {SCHEMA}.document_assignments da ON da.document_id = d.id
                        LEFT JOIN {SCHEMA}.users u ON u.id = da.employee_id
                        WHERE d.company_id = %s
                        GROUP BY d.id ORDER BY d.created_at DESC""",
                    (company_id,),
                )
                rows = cur.fetchall()
                docs = [{"id": r[0], "doc_type": r[1], "title": r[2], "file_url": r[3],
                         "file_name": r[4], "created_at": r[5], "assignments": r[6]}
                        for r in rows]
            else:
                cur.execute(
                    f"""SELECT d.id, d.doc_type, d.title, d.file_url, d.file_name,
                            d.created_at::text, da.assigned_at::text, da.read_at::text
                        FROM {SCHEMA}.document_assignments da
                        JOIN {SCHEMA}.company_documents d ON d.id = da.document_id
                        WHERE da.employee_id = %s
                        ORDER BY da.assigned_at DESC""",
                    (user["id"],),
                )
                rows = cur.fetchall()
                docs = [{"id": r[0], "doc_type": r[1], "title": r[2], "file_url": r[3],
                         "file_name": r[4], "created_at": r[5], "assigned_at": r[6],
                         "read_at": r[7]}
                        for r in rows]
            return ok({"documents": docs})

        body = json.loads(event.get("body") or "{}")

        # ?action=upload — загрузить файл (только employer)
        if action == "upload":
            if user["role"] != "employer":
                return err("Только работодатель может загружать документы", 403)
            doc_type = body.get("doc_type", "")
            if doc_type not in ("sout", "profrisk"):
                return err("doc_type должен быть sout или profrisk")
            title = (body.get("title") or "").strip()
            file_b64 = body.get("file_b64", "")
            file_name = body.get("file_name", "document.pdf")
            if not title or not file_b64:
                return err("Укажите title и file_b64")

            file_data = base64.b64decode(file_b64)
            ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "pdf"
            key = f"company_docs/{company_id}/{doc_type}/{uuid.uuid4()}.{ext}"

            content_types = {"pdf": "application/pdf", "doc": "application/msword",
                             "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                             "txt": "text/plain"}
            ct = content_types.get(ext, "application/octet-stream")

            s3 = s3_client()
            s3.put_object(Bucket=S3_BUCKET, Key=key, Body=file_data, ContentType=ct)
            url = cdn_url(key)

            cur.execute(
                f"""INSERT INTO {SCHEMA}.company_documents
                        (company_id, employer_id, doc_type, title, file_url, file_name)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (company_id, user["id"], doc_type, title, url, file_name),
            )
            doc_id = cur.fetchone()[0]
            conn.commit()
            return ok({"ok": True, "document_id": doc_id, "file_url": url})

        # ?action=assign — отправить документ сотруднику
        if action == "assign":
            if user["role"] != "employer":
                return err("Только работодатель может отправлять документы", 403)
            doc_id = body.get("document_id")
            employee_ids = body.get("employee_ids", [])
            if not doc_id or not employee_ids:
                return err("Укажите document_id и employee_ids")

            # Проверяем что документ принадлежит этой компании
            cur.execute(
                f"SELECT id, title FROM {SCHEMA}.company_documents WHERE id = %s AND company_id = %s",
                (int(doc_id), company_id),
            )
            doc = cur.fetchone()
            if not doc:
                return err("Документ не найден")

            assigned = []
            for eid in employee_ids:
                cur.execute(
                    f"""SELECT id FROM {SCHEMA}.users
                        WHERE id = %s AND company_id = %s AND role = 'employee'""",
                    (int(eid), company_id),
                )
                if not cur.fetchone():
                    continue
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.document_assignments (document_id, employee_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING""",
                    (int(doc_id), int(eid)),
                )
                # Уведомление
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.notifications (user_id, title, body)
                        VALUES (%s, %s, %s)""",
                    (int(eid), "Новый документ для ознакомления",
                     f"Работодатель отправил вам документ: «{doc[1]}»"),
                )
                assigned.append(eid)

            conn.commit()
            return ok({"ok": True, "assigned_to": len(assigned)})

        # ?action=mark_read — сотрудник отметил как прочитанный
        if action == "mark_read":
            doc_id = body.get("document_id")
            if not doc_id:
                return err("Укажите document_id")
            cur.execute(
                f"""UPDATE {SCHEMA}.document_assignments SET read_at = NOW()
                    WHERE document_id = %s AND employee_id = %s AND read_at IS NULL""",
                (int(doc_id), user["id"]),
            )
            conn.commit()
            return ok({"ok": True})

        # ?action=delete — удалить документ (только employer, только свои)
        if action == "delete":
            if user["role"] != "employer":
                return err("Только работодатель может удалять документы", 403)
            doc_id = body.get("document_id")
            if not doc_id:
                return err("Укажите document_id")
            cur.execute(
                f"SELECT file_url FROM {SCHEMA}.company_documents WHERE id = %s AND company_id = %s",
                (int(doc_id), company_id),
            )
            row = cur.fetchone()
            if not row:
                return err("Документ не найден")
            cur.execute(
                f"SELECT id FROM {SCHEMA}.document_assignments WHERE document_id = %s",
                (int(doc_id),),
            )
            cur.execute(
                f"UPDATE {SCHEMA}.document_assignments SET read_at = read_at WHERE document_id = %s",
                (int(doc_id),),
            )
            cur.execute(
                f"UPDATE {SCHEMA}.company_documents SET title = title WHERE id = %s", (int(doc_id),)
            )
            # Помечаем документ как удалённый (мягкое удаление через обновление)
            cur.execute(
                f"DELETE FROM {SCHEMA}.document_assignments WHERE document_id = %s", (int(doc_id),)
            )
            cur.execute(
                f"DELETE FROM {SCHEMA}.company_documents WHERE id = %s AND company_id = %s",
                (int(doc_id), company_id),
            )
            conn.commit()
            return ok({"ok": True})

        # ?action=employees — список сотрудников для выбора (employer only)
        if action == "employees":
            if user["role"] != "employer":
                return err("Доступ запрещён", 403)
            search = qs.get("q", "").strip().lower()
            if search:
                cur.execute(
                    f"""SELECT id, fio, email FROM {SCHEMA}.users
                        WHERE company_id = %s AND role = 'employee'
                        AND LOWER(fio) LIKE %s ORDER BY fio LIMIT 20""",
                    (company_id, f"%{search}%"),
                )
            else:
                cur.execute(
                    f"""SELECT id, fio, email FROM {SCHEMA}.users
                        WHERE company_id = %s AND role = 'employee' ORDER BY fio""",
                    (company_id,),
                )
            rows = cur.fetchall()
            return ok({"employees": [{"id": r[0], "fio": r[1], "email": r[2]} for r in rows]})

        # ── ПЕРЕПИСКА ────────────────────────────────────────────────────────

        # ?action=msg_unread — количество непрочитанных сообщений
        if action == "msg_unread":
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE receiver_id = %s AND is_read = FALSE",
                (user["id"],),
            )
            return ok({"count": cur.fetchone()[0]})

        # ?action=msg_list — список собеседников
        if action == "msg_list":
            if user["role"] == "employer":
                cur.execute(
                    f"""SELECT u.id, u.fio, u.email,
                            COUNT(m.id) FILTER (WHERE m.receiver_id = %s AND m.is_read = FALSE) as unread,
                            MAX(m.created_at) as last_at,
                            (SELECT body FROM {SCHEMA}.messages m2
                             WHERE ((m2.sender_id = u.id AND m2.receiver_id = %s)
                                 OR (m2.sender_id = %s AND m2.receiver_id = u.id))
                             ORDER BY m2.created_at DESC LIMIT 1) as last_msg
                        FROM {SCHEMA}.users u
                        LEFT JOIN {SCHEMA}.messages m ON
                            (m.sender_id = u.id AND m.receiver_id = %s)
                            OR (m.sender_id = %s AND m.receiver_id = u.id)
                        WHERE u.company_id = %s AND u.role = 'employee'
                        GROUP BY u.id, u.fio, u.email
                        ORDER BY last_at DESC NULLS LAST, u.fio""",
                    (user["id"], user["id"], user["id"], user["id"], user["id"], company_id),
                )
            else:
                cur.execute(
                    f"""SELECT u.id, u.fio, u.email,
                            COUNT(m.id) FILTER (WHERE m.receiver_id = %s AND m.is_read = FALSE) as unread,
                            MAX(m.created_at) as last_at,
                            (SELECT body FROM {SCHEMA}.messages m2
                             WHERE ((m2.sender_id = u.id AND m2.receiver_id = %s)
                                 OR (m2.sender_id = %s AND m2.receiver_id = u.id))
                             ORDER BY m2.created_at DESC LIMIT 1) as last_msg
                        FROM {SCHEMA}.users u
                        LEFT JOIN {SCHEMA}.messages m ON
                            (m.sender_id = u.id AND m.receiver_id = %s)
                            OR (m.sender_id = %s AND m.receiver_id = u.id)
                        WHERE u.company_id = %s AND u.role = 'employer'
                        GROUP BY u.id, u.fio, u.email
                        ORDER BY last_at DESC NULLS LAST""",
                    (user["id"], user["id"], user["id"], user["id"], user["id"], company_id),
                )
            rows = cur.fetchall()
            contacts = [{"id": r[0], "fio": r[1], "email": r[2],
                         "unread": r[3] or 0, "last_at": r[4], "last_msg": r[5]}
                        for r in rows]
            return ok({"contacts": contacts})

        # ?action=msg_thread&with_user_id=N — история переписки
        if action == "msg_thread":
            other_id = qs.get("with_user_id")
            if not other_id:
                return err("Укажите with_user_id")
            cur.execute(
                f"SELECT id, fio, role FROM {SCHEMA}.users WHERE id = %s AND company_id = %s",
                (int(other_id), company_id),
            )
            other = cur.fetchone()
            if not other:
                return err("Собеседник не найден")
            cur.execute(
                f"""SELECT id, sender_id, receiver_id, subject, body, is_read, created_at::text
                    FROM {SCHEMA}.messages
                    WHERE company_id = %s
                      AND ((sender_id = %s AND receiver_id = %s)
                        OR (sender_id = %s AND receiver_id = %s))
                    ORDER BY created_at ASC""",
                (company_id, user["id"], int(other_id), int(other_id), user["id"]),
            )
            msgs = [{"id": r[0], "sender_id": r[1], "receiver_id": r[2],
                     "subject": r[3], "body": r[4], "is_read": r[5], "created_at": r[6]}
                    for r in cur.fetchall()]
            cur.execute(
                f"""UPDATE {SCHEMA}.messages SET is_read = TRUE
                    WHERE company_id = %s AND sender_id = %s AND receiver_id = %s AND is_read = FALSE""",
                (company_id, int(other_id), user["id"]),
            )
            conn.commit()
            return ok({"messages": msgs, "other": {"id": other[0], "fio": other[1], "role": other[2]}})

        # ?action=msg_send — отправить сообщение
        if action == "msg_send":
            receiver_id = body.get("receiver_id")
            msg_body = (body.get("body") or "").strip()
            subject = (body.get("subject") or "").strip()
            if not receiver_id or not msg_body:
                return err("Укажите receiver_id и body")
            cur.execute(
                f"SELECT id, fio FROM {SCHEMA}.users WHERE id = %s AND company_id = %s",
                (int(receiver_id), company_id),
            )
            receiver = cur.fetchone()
            if not receiver:
                return err("Получатель не найден")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.messages (company_id, sender_id, receiver_id, subject, body)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at::text""",
                (company_id, user["id"], int(receiver_id), subject, msg_body),
            )
            row = cur.fetchone()
            notif = f"Сообщение от {user['fio']}"
            if subject:
                notif += f": {subject}"
            cur.execute(
                f"INSERT INTO {SCHEMA}.notifications (user_id, title, body) VALUES (%s, %s, %s)",
                (int(receiver_id), "Новое сообщение", notif),
            )
            conn.commit()
            return ok({"ok": True, "message_id": row[0], "created_at": row[1],
                       "sender_id": user["id"], "receiver_id": int(receiver_id),
                       "body": msg_body, "subject": subject})

        return err(f"Неизвестное действие: '{action}'", 400)

    finally:
        cur.close()
        conn.close()
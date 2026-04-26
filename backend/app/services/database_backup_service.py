from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

from sqlalchemy import delete, insert, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth_action_token import AuthActionToken
from app.models.project import Project
from app.models.project_settings import ProjectSettings
from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage
from app.models.system_settings import SystemSettings
from app.models.test import Test
from app.models.test_run import TestRun
from app.models.user import User

BACKUP_FORMAT_VERSION = 1
BACKUP_CONTENT_TYPE = "application/json; charset=utf-8"

CORE_MODELS = [
    User,
    Project,
    ProjectSettings,
    Test,
    TestRun,
    SystemSettings,
]

OPTIONAL_MODELS = [
    SupportConversation,
    SupportMessage,
    AuthActionToken,
]

EXPORT_MODELS = [
    *CORE_MODELS,
    *OPTIONAL_MODELS,
]

IMPORT_MODELS = [
    *CORE_MODELS,
    *OPTIONAL_MODELS,
]

DELETE_MODELS = [
    SupportMessage,
    SupportConversation,
    AuthActionToken,
    TestRun,
    Test,
    ProjectSettings,
    Project,
    SystemSettings,
    User,
]

REQUIRED_TABLES = {model.__tablename__ for model in CORE_MODELS}
OPTIONAL_TABLES = {model.__tablename__ for model in OPTIONAL_MODELS}


class DatabaseBackupError(ValueError):
    pass


def _serialize_value(value: Any):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _deserialize_value(column, value):
    if value is None:
        return None

    python_type = None
    try:
        python_type = column.type.python_type
    except (AttributeError, NotImplementedError):
        python_type = None

    if python_type is datetime and isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError as exc:
            raise DatabaseBackupError(f"Поле ({column.name}) содержит некорректную дату и время.") from exc

    return value


def _normalize_row(model, row: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(row, dict):
        raise DatabaseBackupError(f"Таблица ({model.__tablename__}) содержит запись в некорректном формате.")

    prepared: dict[str, Any] = {}
    for column in model.__table__.columns:
        if column.name not in row:
            continue
        prepared[column.name] = _deserialize_value(column, row[column.name])
    return prepared


def build_backup_payload(db: Session) -> dict[str, Any]:
    tables: dict[str, list[dict[str, Any]]] = {}

    for model in EXPORT_MODELS:
        primary_key = next(iter(model.__table__.primary_key.columns), None)
        statement = select(model)
        if primary_key is not None:
            statement = statement.order_by(primary_key)

        rows = db.scalars(statement).all()
        tables[model.__tablename__] = [
            {
                column.name: _serialize_value(getattr(row, column.name))
                for column in model.__table__.columns
            }
            for row in rows
        ]

    return {
        "format_version": BACKUP_FORMAT_VERSION,
        "created_at": datetime.utcnow().isoformat(),
        "tables": tables,
    }


def build_backup_file_name(prefix: str) -> str:
    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    return f"{prefix}-{timestamp}.json"


def build_backup_bytes(db: Session) -> tuple[bytes, str, dict[str, Any]]:
    payload = build_backup_payload(db)
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    file_name = build_backup_file_name("резервная-копия-базы-данных")
    return content, file_name, payload


def save_backup_bytes(content: bytes, file_name: str) -> str:
    backup_dir = Path(settings.database_backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    file_path = backup_dir / file_name
    file_path.write_bytes(content)
    return str(file_path)


def parse_backup_content(content: str) -> dict[str, Any]:
    if not content or not content.strip():
        raise DatabaseBackupError("Файл резервной копии пустой.")

    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise DatabaseBackupError("Не удалось прочитать файл резервной копии. Проверьте его формат.") from exc

    if not isinstance(payload, dict):
        raise DatabaseBackupError("Файл резервной копии имеет некорректную структуру.")

    if payload.get("format_version") != BACKUP_FORMAT_VERSION:
        raise DatabaseBackupError("Файл резервной копии создан в неподдерживаемом формате.")

    tables = payload.get("tables")
    if not isinstance(tables, dict):
        raise DatabaseBackupError("В файле резервной копии отсутствуют таблицы для восстановления.")

    missing_tables = sorted(REQUIRED_TABLES - set(tables.keys()))
    if missing_tables:
        missing_tables_text = ", ".join(missing_tables)
        raise DatabaseBackupError(f"В файле резервной копии отсутствуют обязательные таблицы: {missing_tables_text}.")

    normalized_payload = dict(payload)
    normalized_tables = dict(tables)
    for table_name in OPTIONAL_TABLES:
        normalized_tables.setdefault(table_name, [])
    normalized_payload["tables"] = normalized_tables

    return normalized_payload


def restore_database_from_payload(db: Session, payload: dict[str, Any]) -> dict[str, int]:
    tables = payload["tables"]
    restored_counts: dict[str, int] = {}

    try:
        for model in DELETE_MODELS:
            db.execute(delete(model))

        for model in IMPORT_MODELS:
            raw_rows = tables.get(model.__tablename__, [])
            if not isinstance(raw_rows, list):
                raise DatabaseBackupError(f"Таблица ({model.__tablename__}) содержит некорректный набор данных.")

            prepared_rows = [_normalize_row(model, row) for row in raw_rows]
            if prepared_rows:
                db.execute(insert(model), prepared_rows)
            restored_counts[model.__tablename__] = len(prepared_rows)

        _reset_primary_key_sequences(db)
        db.commit()
        db.expire_all()
    except Exception:
        db.rollback()
        raise

    return restored_counts


def _reset_primary_key_sequences(db: Session) -> None:
    for model in IMPORT_MODELS:
        table_name = model.__tablename__
        sequence_name = db.scalar(text("SELECT pg_get_serial_sequence(:table_name, 'id')"), {"table_name": table_name})
        if not sequence_name:
            continue

        max_id = db.scalar(text(f'SELECT MAX(id) FROM "{table_name}"'))
        if max_id is None:
            db.execute(text("SELECT setval(:sequence_name, 1, false)"), {"sequence_name": sequence_name})
        else:
            db.execute(text("SELECT setval(:sequence_name, :value, true)"), {"sequence_name": sequence_name, "value": int(max_id)})


def build_download_headers(file_name: str) -> dict[str, str]:
    encoded_file_name = quote(file_name)
    return {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_file_name}",
    }

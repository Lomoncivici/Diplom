from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.database_backup import DatabaseRestoreRequest, DatabaseRestoreResponse
from app.schemas.system_settings import RuntimePolicyResponse, SystemSettingsResponse, SystemSettingsUpdate
from app.services.account_security_service import cleanup_expired_security_state, encrypt_secret
from app.services.database_backup_service import (
    BACKUP_CONTENT_TYPE,
    DatabaseBackupError,
    build_backup_bytes,
    build_download_headers,
    parse_backup_content,
    restore_database_from_payload,
    save_backup_bytes,
)
from app.services.platform_status_service import platform_status_service
from app.services.system_settings_service import (
    get_effective_allow_private_target_hosts,
    get_or_create_system_settings,
)

router = APIRouter(tags=["system-settings"])


def _serialize_system_settings(system_settings) -> SystemSettingsResponse:
    data = SystemSettingsResponse.model_validate(system_settings, from_attributes=True).model_dump()
    data["smtp_password"] = None
    data["smtp_password_configured"] = bool(getattr(system_settings, "smtp_password_encrypted", None))
    return SystemSettingsResponse.model_validate(data)


@router.get("/admin/system-settings", response_model=SystemSettingsResponse)
def read_system_settings(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    system_settings = get_or_create_system_settings(db)
    if not hasattr(system_settings, "id"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Системные настройки недоступны до применения миграций базы данных.")
    return _serialize_system_settings(system_settings)


@router.put("/admin/system-settings", response_model=SystemSettingsResponse)
def update_system_settings(
    payload: SystemSettingsUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    system_settings = get_or_create_system_settings(db)
    if not hasattr(system_settings, "id"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Сначала примените миграции базы данных для системных настроек.")

    payload_data = payload.model_dump()
    smtp_password = payload_data.pop("smtp_password", None)

    for field, value in payload_data.items():
        setattr(system_settings, field, value)

    if smtp_password is not None:
        system_settings.smtp_password_encrypted = encrypt_secret(smtp_password)

    db.commit()
    db.refresh(system_settings)
    return _serialize_system_settings(system_settings)


@router.get("/admin/database-backup")
def download_database_backup(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    with platform_status_service.technical_works("Создание резервной копии базы данных"):
        content, file_name, _ = build_backup_bytes(db)

    return Response(
        content=content,
        media_type=BACKUP_CONTENT_TYPE,
        headers=build_download_headers(file_name),
    )


@router.get("/admin/database-backup/automatic")
def download_last_automatic_backup(
    _: User = Depends(require_admin),
):
    file_path, file_name = platform_status_service.get_last_auto_backup()
    if not file_path or not file_name:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Автоматическая резервная копия пока не создана.")

    try:
        content = open(file_path, "rb").read()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл автоматической резервной копии не найден.") from exc

    return Response(
        content=content,
        media_type=BACKUP_CONTENT_TYPE,
        headers=build_download_headers(file_name),
    )


@router.post("/admin/database-restore", response_model=DatabaseRestoreResponse)
def restore_database_backup(
    payload: DatabaseRestoreRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    with platform_status_service.technical_works("Восстановление базы данных из резервной копии"):
        automatic_backup_content, automatic_backup_file_name, _ = build_backup_bytes(db)
        automatic_backup_path = save_backup_bytes(automatic_backup_content, automatic_backup_file_name)
        platform_status_service.set_last_auto_backup(automatic_backup_path, automatic_backup_file_name)

        try:
            backup_payload = parse_backup_content(payload.content)
            restored_table_counts = restore_database_from_payload(db, backup_payload)
        except DatabaseBackupError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось восстановить базу данных. Изменения не были применены.",
            ) from exc

    return DatabaseRestoreResponse(
        message="База данных успешно восстановлена из резервной копии.",
        restored_table_counts=restored_table_counts,
        automatic_backup_file_name=automatic_backup_file_name,
        automatic_backup_created_at=datetime.now(timezone.utc),
    )


@router.get("/system/runtime-policy", response_model=RuntimePolicyResponse)
def read_runtime_policy(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    system_settings = get_or_create_system_settings(db)
    platform_status = platform_status_service.get_snapshot()
    return RuntimePolicyResponse(
        allow_private_target_hosts=get_effective_allow_private_target_hosts(system_settings),
        allow_test_run_launches=bool(getattr(system_settings, "allow_test_run_launches", True)),
        max_virtual_users_per_test=int(getattr(system_settings, "max_virtual_users_per_test", 200)),
        max_repeat_count_per_test=int(getattr(system_settings, "max_repeat_count_per_test", 500)),
        max_timeout_seconds=int(getattr(system_settings, "max_timeout_seconds", 120)),
        max_logs_per_run=int(getattr(system_settings, "max_logs_per_run", 500)),
        technical_works_active=platform_status.technical_works_active,
        technical_works_message=platform_status.technical_works_message,
        technical_works_operation=platform_status.current_operation,
    )

from types import SimpleNamespace

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.system_settings import SystemSettings


SYSTEM_SETTINGS_ID = 1


DEFAULT_EMAIL_VERIFICATION_BODY = (
    "Здравствуйте, {{full_name}}!\n\n"
    "Для подтверждения адреса перейдите по ссылке:\n{{link}}\n\n"
    "Ссылка действует {{minutes}} минут."
)
DEFAULT_EMAIL_CHANGE_BODY = (
    "Здравствуйте, {{full_name}}!\n\n"
    "Для подтверждения нового адреса {{new_email}} перейдите по ссылке:\n{{link}}\n\n"
    "Ссылка действует {{minutes}} минут."
)
DEFAULT_PASSWORD_RESET_BODY = (
    "Здравствуйте, {{full_name}}!\n\n"
    "Для сброса пароля перейдите по ссылке:\n{{link}}\n\n"
    "Ссылка действует {{minutes}} минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо."
)


def build_default_runtime_policy():
    return SimpleNamespace(
        allow_private_target_hosts=settings.allow_private_target_hosts_effective,
        allow_test_run_launches=True,
        max_virtual_users_per_test=200,
        max_repeat_count_per_test=500,
        max_timeout_seconds=120,
        max_logs_per_run=500,
        email_enabled=False,
        smtp_host=None,
        smtp_port=587,
        smtp_username=None,
        smtp_password_encrypted=None,
        smtp_use_tls=True,
        smtp_use_ssl=False,
        email_from_address=None,
        email_from_name="Платформа тестирования API",
        frontend_base_url="http://localhost:5173",
        email_verification_subject_template="Подтверждение адреса электронной почты",
        email_verification_body_template=DEFAULT_EMAIL_VERIFICATION_BODY,
        email_change_subject_template="Подтверждение нового адреса электронной почты",
        email_change_body_template=DEFAULT_EMAIL_CHANGE_BODY,
        password_reset_subject_template="Сброс пароля",
        password_reset_body_template=DEFAULT_PASSWORD_RESET_BODY,
    )


def _has_system_settings_table(db: Session) -> bool:
    bind = db.get_bind()
    if bind is None:
        return False
    return inspect(bind).has_table("system_settings")


def get_or_create_system_settings(db: Session):
    if not _has_system_settings_table(db):
        return build_default_runtime_policy()

    system_settings = db.scalar(select(SystemSettings).where(SystemSettings.id == SYSTEM_SETTINGS_ID))
    if system_settings:
        return system_settings

    system_settings = SystemSettings(id=SYSTEM_SETTINGS_ID)
    db.add(system_settings)
    db.commit()
    db.refresh(system_settings)
    return system_settings


def get_effective_allow_private_target_hosts(runtime_settings) -> bool:
    return bool(getattr(runtime_settings, "allow_private_target_hosts", False)) or settings.allow_private_target_hosts_effective

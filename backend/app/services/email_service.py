from __future__ import annotations

import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.validation import normalize_email
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.services.account_security_service import (
    EMAIL_CHANGE_ACTION,
    EMAIL_VERIFICATION_ACTION,
    PASSWORD_RESET_ACTION,
    PASSWORD_RESET_TTL_MINUTES,
    VERIFICATION_TTL_MINUTES,
    decrypt_secret,
)


class EmailDeliveryError(RuntimeError):
    pass


DEFAULT_FRONTEND_BASE_URL = "http://localhost:5173"


def ensure_email_settings_ready(runtime_settings: SystemSettings) -> None:
    if not getattr(runtime_settings, "email_enabled", False):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Почтовые уведомления сейчас отключены администратором.")

    required_fields = {
        "smtp_host": getattr(runtime_settings, "smtp_host", None),
        "email_from_address": getattr(runtime_settings, "email_from_address", None),
        "frontend_base_url": getattr(runtime_settings, "frontend_base_url", None) or DEFAULT_FRONTEND_BASE_URL,
    }
    missing = [label for label, value in required_fields.items() if not value]
    if missing:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Почтовые настройки заполнены не полностью. Обратитесь к администратору.")


def _render_template(template: str, replacements: dict[str, str]) -> str:
    result = template
    for key, value in replacements.items():
        result = result.replace(f"{{{{{key}}}}}", value)
    return result


def _build_link(base_url: str, action_type: str, token: str) -> str:
    normalized = base_url.rstrip("/")
    if action_type in {EMAIL_VERIFICATION_ACTION, EMAIL_CHANGE_ACTION}:
        return f"{normalized}/подтверждение-почты/{token}"
    if action_type == PASSWORD_RESET_ACTION:
        return f"{normalized}/сброс-пароля/{token}"
    return normalized


def _get_templates(runtime_settings: SystemSettings, action_type: str) -> tuple[str, str]:
    if action_type == EMAIL_VERIFICATION_ACTION:
        return runtime_settings.email_verification_subject_template, runtime_settings.email_verification_body_template
    if action_type == EMAIL_CHANGE_ACTION:
        return runtime_settings.email_change_subject_template, runtime_settings.email_change_body_template
    if action_type == PASSWORD_RESET_ACTION:
        return runtime_settings.password_reset_subject_template, runtime_settings.password_reset_body_template
    raise EmailDeliveryError("Неизвестный тип почтового уведомления.")


def send_action_email(
    runtime_settings: SystemSettings,
    *,
    user: User,
    action_type: str,
    token: str,
    target_email: str,
) -> None:
    ensure_email_settings_ready(runtime_settings)

    smtp_host = runtime_settings.smtp_host
    smtp_port = int(runtime_settings.smtp_port or 587)
    smtp_username = runtime_settings.smtp_username or None
    smtp_password = decrypt_secret(runtime_settings.smtp_password_encrypted)
    sender_email = normalize_email(runtime_settings.email_from_address or "")
    sender_name = (runtime_settings.email_from_name or "Платформа тестирования API").strip()
    frontend_base_url = runtime_settings.frontend_base_url or DEFAULT_FRONTEND_BASE_URL

    subject_template, body_template = _get_templates(runtime_settings, action_type)
    link = _build_link(frontend_base_url, action_type, token)
    subject = _render_template(subject_template, {
        "full_name": user.full_name,
        "email": user.email,
        "new_email": target_email,
        "link": link,
        "minutes": str(PASSWORD_RESET_TTL_MINUTES if action_type == PASSWORD_RESET_ACTION else VERIFICATION_TTL_MINUTES),
    })
    body = _render_template(body_template, {
        "full_name": user.full_name,
        "email": user.email,
        "new_email": target_email,
        "link": link,
        "minutes": str(PASSWORD_RESET_TTL_MINUTES if action_type == PASSWORD_RESET_ACTION else VERIFICATION_TTL_MINUTES),
    })

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{sender_name} <{sender_email}>" if sender_name else sender_email
    message["To"] = target_email
    message.set_content(body)

    try:
        if runtime_settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                if smtp_username:
                    server.login(smtp_username, smtp_password or "")
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.ehlo()
                if runtime_settings.smtp_use_tls:
                    server.starttls()
                    server.ehlo()
                if smtp_username:
                    server.login(smtp_username, smtp_password or "")
                server.send_message(message)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Не удалось отправить письмо. Проверьте почтовые настройки администратора.") from exc

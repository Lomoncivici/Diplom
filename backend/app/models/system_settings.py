from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)

    allow_private_target_hosts: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_test_run_launches: Mapped[bool] = mapped_column(Boolean, default=True)

    max_virtual_users_per_test: Mapped[int] = mapped_column(Integer, default=200)
    max_repeat_count_per_test: Mapped[int] = mapped_column(Integer, default=500)
    max_timeout_seconds: Mapped[int] = mapped_column(Integer, default=120)
    max_logs_per_run: Mapped[int] = mapped_column(Integer, default=500)

    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int] = mapped_column(Integer, default=587)
    smtp_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    smtp_use_ssl: Mapped[bool] = mapped_column(Boolean, default=False)
    email_from_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    frontend_base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email_verification_subject_template: Mapped[str] = mapped_column(String(255), default='Подтверждение адреса электронной почты')
    email_verification_body_template: Mapped[str] = mapped_column(Text, default='Здравствуйте, {{full_name}}!\n\nДля подтверждения адреса перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.')
    email_change_subject_template: Mapped[str] = mapped_column(String(255), default='Подтверждение нового адреса электронной почты')
    email_change_body_template: Mapped[str] = mapped_column(Text, default='Здравствуйте, {{full_name}}!\n\nДля подтверждения нового адреса {{new_email}} перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.')
    password_reset_subject_template: Mapped[str] = mapped_column(String(255), default='Сброс пароля')
    password_reset_body_template: Mapped[str] = mapped_column(Text, default='Здравствуйте, {{full_name}}!\n\nДля сброса пароля перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.')

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

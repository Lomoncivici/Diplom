from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.validation import normalize_email, validate_http_url


class SystemSettingsBase(BaseModel):
    allow_private_target_hosts: bool = False
    allow_test_run_launches: bool = True
    max_virtual_users_per_test: int = Field(default=200, ge=1, le=100000)
    max_repeat_count_per_test: int = Field(default=500, ge=1, le=100000)
    max_timeout_seconds: int = Field(default=120, ge=1, le=3600)
    max_logs_per_run: int = Field(default=500, ge=50, le=10000)
    email_enabled: bool = False
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, min_length=1, max_length=255)
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    email_from_address: EmailStr | None = None
    email_from_name: str | None = Field(default=None, max_length=255)
    frontend_base_url: str | None = Field(default=None, max_length=500)
    email_verification_subject_template: str = Field(default='Подтверждение адреса электронной почты', min_length=3, max_length=255)
    email_verification_body_template: str = Field(default='Здравствуйте, {{full_name}}!\n\nДля подтверждения адреса перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.', min_length=10, max_length=10000)
    email_change_subject_template: str = Field(default='Подтверждение нового адреса электронной почты', min_length=3, max_length=255)
    email_change_body_template: str = Field(default='Здравствуйте, {{full_name}}!\n\nДля подтверждения нового адреса {{new_email}} перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.', min_length=10, max_length=10000)
    password_reset_subject_template: str = Field(default='Сброс пароля', min_length=3, max_length=255)
    password_reset_body_template: str = Field(default='Здравствуйте, {{full_name}}!\n\nДля сброса пароля перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.', min_length=10, max_length=10000)

    @field_validator("smtp_host", "smtp_username", "email_from_name")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("email_from_address")
    @classmethod
    def normalize_email_value(cls, value: EmailStr | None) -> str | None:
        if value is None:
            return None
        return normalize_email(str(value))

    @field_validator("frontend_base_url")
    @classmethod
    def validate_frontend_url(cls, value: str | None) -> str | None:
        return validate_http_url(value, field_name='Адрес пользовательского интерфейса')


class SystemSettingsUpdate(SystemSettingsBase):
    pass


class SystemSettingsResponse(SystemSettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime
    smtp_password: str | None = None
    smtp_password_configured: bool = False

    class Config:
        from_attributes = True


class RuntimePolicyResponse(BaseModel):
    allow_private_target_hosts: bool
    allow_test_run_launches: bool
    max_virtual_users_per_test: int
    max_repeat_count_per_test: int
    max_timeout_seconds: int
    max_logs_per_run: int
    technical_works_active: bool = False
    technical_works_message: str | None = None
    technical_works_operation: str | None = None

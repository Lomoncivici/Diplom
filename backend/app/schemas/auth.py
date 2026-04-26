from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.validation import normalize_email, validate_password_strength


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email_value(cls, value: EmailStr) -> str:
        return normalize_email(str(value))

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email_value(cls, value: EmailStr) -> str:
        return normalize_email(str(value))


class PasswordResetRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email_value(cls, value: EmailStr) -> str:
        return normalize_email(str(value))


class PasswordResetConfirmRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class ActionTokenInfoResponse(BaseModel):
    action_type: str
    target_email: str | None = None
    expires_at: datetime
    full_name: str
    current_email: str


class MessageResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

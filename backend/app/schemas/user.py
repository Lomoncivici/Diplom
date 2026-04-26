from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.validation import normalize_email, validate_password_strength


UserRole = Literal['admin', 'student']


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    email_verified_at: datetime | None = None
    email_verification_deadline_at: datetime | None = None
    pending_email: EmailStr | None = None
    pending_email_requested_at: datetime | None = None
    pending_email_deadline_at: datetime | None = None
    email_is_verified: bool = False

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = 'student'
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def normalize_email_value(cls, value: EmailStr) -> str:
        return normalize_email(str(value))

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserUpdate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole
    is_active: bool
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email_value(cls, value: EmailStr) -> str:
        return normalize_email(str(value))

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_password_strength(value)


class EmailChangeRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=1, max_length=128)

    @field_validator("new_email")
    @classmethod
    def normalize_email_value(cls, value: EmailStr) -> str:
        return normalize_email(str(value))

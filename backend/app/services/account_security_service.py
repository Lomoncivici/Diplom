from __future__ import annotations

import hashlib
import secrets
from base64 import urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from threading import Lock

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth_action_token import AuthActionToken
from app.models.user import User

EMAIL_VERIFICATION_ACTION = "email_verification"
EMAIL_CHANGE_ACTION = "email_change"
PASSWORD_RESET_ACTION = "password_reset"
VERIFICATION_TTL_MINUTES = 15
PASSWORD_RESET_TTL_MINUTES = 15
SEND_COOLDOWN_SECONDS = 60

_cleanup_lock = Lock()
_last_cleanup_at: datetime | None = None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_verification_deadline() -> datetime:
    return utcnow() + timedelta(minutes=VERIFICATION_TTL_MINUTES)


def get_password_reset_deadline() -> datetime:
    return utcnow() + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES)


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).digest()
    return Fernet(urlsafe_b64encode(digest))


def encrypt_secret(value: str | None) -> str | None:
    if not value:
        return None
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось прочитать защищённые настройки почты.") from exc


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def cleanup_expired_security_state(db: Session) -> None:
    global _last_cleanup_at
    now = utcnow()
    with _cleanup_lock:
        if _last_cleanup_at and (now - _last_cleanup_at).total_seconds() < 30:
            return
        _last_cleanup_at = now

    expired_users = list(
        db.scalars(
            select(User).where(
                User.email_verified_at.is_(None),
                User.email_verification_deadline_at.is_not(None),
                User.email_verification_deadline_at < now,
            )
        ).all()
    )
    for user in expired_users:
        db.delete(user)

    pending_email_users = list(
        db.scalars(
            select(User).where(
                User.pending_email.is_not(None),
                User.pending_email_deadline_at.is_not(None),
                User.pending_email_deadline_at < now,
            )
        ).all()
    )
    for user in pending_email_users:
        user.pending_email = None
        user.pending_email_requested_at = None
        user.pending_email_deadline_at = None

    db.execute(
        delete(AuthActionToken).where(
            or_(
                AuthActionToken.expires_at < now,
                AuthActionToken.consumed_at.is_not(None),
            )
        )
    )
    db.commit()


def ensure_user_not_expired(db: Session, user: User) -> None:
    if user.email_verified_at is not None:
        return

    deadline = user.email_verification_deadline_at
    if deadline and deadline < utcnow():
        db.delete(user)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Срок подтверждения адреса электронной почты истёк. Учётная запись удалена.")


def create_action_token(
    db: Session,
    *,
    user: User,
    action_type: str,
    expires_at: datetime,
    target_email: str | None = None,
    requested_by_ip: str | None = None,
) -> str:
    existing = db.scalars(
        select(AuthActionToken)
        .where(
            AuthActionToken.user_id == user.id,
            AuthActionToken.action_type == action_type,
            AuthActionToken.consumed_at.is_(None),
        )
        .order_by(AuthActionToken.created_at.desc())
    ).first()

    now = utcnow()
    if existing and (now - existing.created_at).total_seconds() < SEND_COOLDOWN_SECONDS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Повторная отправка временно недоступна. Попробуйте немного позже.")

    if existing:
        existing.consumed_at = now

    token = secrets.token_urlsafe(32)
    db.add(
        AuthActionToken(
            user_id=user.id,
            action_type=action_type,
            token_hash=hash_token(token),
            target_email=target_email,
            requested_by_ip=requested_by_ip,
            expires_at=expires_at,
        )
    )
    db.flush()
    return token


def get_valid_action_token(db: Session, token: str, action_type: str) -> AuthActionToken:
    token_row = db.scalar(
        select(AuthActionToken).where(
            AuthActionToken.token_hash == hash_token(token),
            AuthActionToken.action_type == action_type,
        )
    )
    if token_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Временная ссылка не найдена или уже недействительна.")
    if token_row.consumed_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Эта ссылка уже была использована.")
    if token_row.expires_at < utcnow():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Срок действия ссылки истёк.")
    return token_row


def consume_action_token(token_row: AuthActionToken) -> None:
    token_row.consumed_at = utcnow()

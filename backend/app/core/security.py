from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic
from typing import Any

from fastapi import HTTPException, status
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_failed_auth_attempts: dict[str, list[float]] = {}
_auth_lock = Lock()


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    now = datetime.now(timezone.utc)
    to_encode = {"exp": expire, "iat": now, "sub": str(subject), "type": "access"}
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def _prune_attempts(now: float, window_seconds: float, lock_seconds: float) -> None:
    max_age = max(window_seconds, lock_seconds)
    expired_keys = [
        key for key, attempts in _failed_auth_attempts.items() if not attempts or now - attempts[-1] > max_age
    ]
    for key in expired_keys:
        _failed_auth_attempts.pop(key, None)


def ensure_auth_not_rate_limited(identifier: str) -> None:
    now = monotonic()
    window_seconds = settings.auth_rate_limit_window_minutes * 60
    lock_seconds = settings.auth_rate_limit_lock_minutes * 60

    with _auth_lock:
        _prune_attempts(now, window_seconds, lock_seconds)
        attempts = [ts for ts in _failed_auth_attempts.get(identifier, []) if now - ts <= window_seconds]
        _failed_auth_attempts[identifier] = attempts

        if len(attempts) >= settings.auth_rate_limit_max_failures and now - attempts[-1] <= lock_seconds:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много неудачных попыток входа. Попробуйте позже.",
            )


def register_auth_failure(identifier: str) -> None:
    now = monotonic()
    window_seconds = settings.auth_rate_limit_window_minutes * 60
    lock_seconds = settings.auth_rate_limit_lock_minutes * 60

    with _auth_lock:
        _prune_attempts(now, window_seconds, lock_seconds)
        attempts = [ts for ts in _failed_auth_attempts.get(identifier, []) if now - ts <= window_seconds]
        attempts.append(now)
        _failed_auth_attempts[identifier] = attempts


def clear_auth_failures(identifier: str) -> None:
    with _auth_lock:
        _failed_auth_attempts.pop(identifier, None)

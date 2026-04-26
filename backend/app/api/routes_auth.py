from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    clear_auth_failures,
    create_access_token,
    ensure_auth_not_rate_limited,
    get_password_hash,
    register_auth_failure,
    verify_password,
)
from app.dependencies import get_db
from app.models.auth_action_token import AuthActionToken
from app.models.user import User
from app.schemas.auth import (
    ActionTokenInfoResponse,
    LoginRequest,
    MessageResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.account_security_service import (
    EMAIL_CHANGE_ACTION,
    EMAIL_VERIFICATION_ACTION,
    PASSWORD_RESET_ACTION,
    cleanup_expired_security_state,
    consume_action_token,
    create_action_token,
    get_password_reset_deadline,
    get_valid_action_token,
    hash_token,
    get_verification_deadline,
    utcnow,
)
from app.services.email_service import send_action_email
from app.services.system_settings_service import get_or_create_system_settings


router = APIRouter(prefix="/auth", tags=["auth"])


def _build_auth_identifier(request: Request, email: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{email}|{client_host}"


def _set_access_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key=settings.access_token_cookie_name,
        value=access_token,
        httponly=True,
        secure=settings.jwt_cookie_secure,
        samesite=settings.jwt_cookie_samesite,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    identifier = _build_auth_identifier(request, payload.email)
    ensure_auth_not_rate_limited(identifier)

    existing_user = db.scalar(select(User).where(or_(User.email == payload.email, User.pending_email == payload.email)))
    if existing_user:
        register_auth_failure(identifier)
        raise HTTPException(status_code=400, detail="Пользователь с таким адресом уже существует")

    runtime_settings = get_or_create_system_settings(db)

    user = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        role="student",
        is_active=True,
        email_verified_at=None,
        email_verification_deadline_at=get_verification_deadline(),
    )
    db.add(user)
    db.flush()

    verification_token = create_action_token(
        db,
        user=user,
        action_type=EMAIL_VERIFICATION_ACTION,
        expires_at=get_verification_deadline(),
        target_email=user.email,
        requested_by_ip=request.client.host if request.client else None,
    )
    send_action_email(runtime_settings, user=user, action_type=EMAIL_VERIFICATION_ACTION, token=verification_token, target_email=user.email)
    db.commit()
    db.refresh(user)

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    token = create_access_token(user.id, expires_delta=access_token_expires)
    _set_access_cookie(response, token)
    clear_auth_failures(identifier)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    identifier = _build_auth_identifier(request, payload.email)
    ensure_auth_not_rate_limited(identifier)

    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        register_auth_failure(identifier)
        raise HTTPException(status_code=401, detail="Неверный адрес или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учётная запись пользователя отключена")
    if user.email_verified_at is None and user.email_verification_deadline_at and user.email_verification_deadline_at < utcnow():
        db.delete(user)
        db.commit()
        raise HTTPException(status_code=401, detail="Срок подтверждения адреса электронной почты истёк. Учётная запись удалена.")

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    token = create_access_token(user.id, expires_delta=access_token_expires)
    _set_access_cookie(response, token)
    clear_auth_failures(identifier)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(key=settings.access_token_cookie_name, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/password-reset/request", response_model=MessageResponse)
def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    user = db.scalar(select(User).where(User.email == payload.email))
    runtime_settings = get_or_create_system_settings(db)

    if user and user.is_active and user.email_verified_at is not None:
        reset_token = create_action_token(
            db,
            user=user,
            action_type=PASSWORD_RESET_ACTION,
            expires_at=get_password_reset_deadline(),
            target_email=user.email,
            requested_by_ip=request.client.host if request.client else None,
        )
        send_action_email(runtime_settings, user=user, action_type=PASSWORD_RESET_ACTION, token=reset_token, target_email=user.email)
        db.commit()

    return MessageResponse(message="Если пользователь с таким адресом существует, письмо для восстановления уже отправлено.")


@router.get("/action-links/{token}", response_model=ActionTokenInfoResponse)
def read_action_token_info(token: str, db: Session = Depends(get_db)):
    cleanup_expired_security_state(db)
    token_row = db.scalar(select(AuthActionToken).where(AuthActionToken.token_hash == hash_token(token)))
    if token_row is None:
        raise HTTPException(status_code=404, detail="Временная ссылка не найдена или уже недействительна.")
    if token_row.consumed_at is not None:
        raise HTTPException(status_code=410, detail="Эта ссылка уже была использована.")
    if token_row.expires_at < utcnow():
        raise HTTPException(status_code=410, detail="Срок действия ссылки истёк.")
    user = db.scalar(select(User).where(User.id == token_row.user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь для этой ссылки не найден.")
    return ActionTokenInfoResponse(
        action_type=token_row.action_type,
        target_email=token_row.target_email,
        expires_at=token_row.expires_at,
        full_name=user.full_name,
        current_email=user.email,
    )


@router.post("/verify-email/{token}", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    cleanup_expired_security_state(db)

    token_row = db.scalar(select(AuthActionToken).where(AuthActionToken.token_hash == hash_token(token)))
    if token_row is None or token_row.action_type not in {EMAIL_CHANGE_ACTION, EMAIL_VERIFICATION_ACTION}:
        raise HTTPException(status_code=404, detail="Временная ссылка не найдена или уже недействительна.")
    if token_row.consumed_at is not None:
        raise HTTPException(status_code=410, detail="Эта ссылка уже была использована.")
    if token_row.expires_at < utcnow():
        raise HTTPException(status_code=410, detail="Срок действия ссылки истёк.")
    action_type = token_row.action_type

    user = db.scalar(select(User).where(User.id == token_row.user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь для этой ссылки не найден.")

    target_email = token_row.target_email or user.email
    existing = db.scalar(select(User).where(User.email == target_email, User.id != user.id))
    if existing:
        raise HTTPException(status_code=400, detail="Адрес электронной почты уже используется другим пользователем.")

    if action_type == EMAIL_CHANGE_ACTION:
        if user.pending_email != target_email:
            raise HTTPException(status_code=400, detail="Ожидание подтверждения нового адреса уже отменено.")
        user.email = target_email
        user.pending_email = None
        user.pending_email_requested_at = None
        user.pending_email_deadline_at = None
    user.email_verified_at = utcnow()
    user.email_verification_deadline_at = None
    consume_action_token(token_row)
    db.commit()
    return MessageResponse(message="Адрес электронной почты успешно подтверждён.")


@router.post("/password-reset/{token}", response_model=MessageResponse)
def confirm_password_reset(
    token: str,
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    token_row = get_valid_action_token(db, token, PASSWORD_RESET_ACTION)
    user = db.scalar(select(User).where(User.id == token_row.user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь для этой ссылки не найден.")

    user.hashed_password = get_password_hash(payload.password)
    consume_action_token(token_row)
    db.commit()
    return MessageResponse(message="Пароль успешно обновлён.")

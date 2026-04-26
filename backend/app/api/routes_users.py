from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import EmailChangeRequest, UserCreate, UserResponse, UserUpdate
from app.services.account_security_service import (
    EMAIL_CHANGE_ACTION,
    EMAIL_VERIFICATION_ACTION,
    cleanup_expired_security_state,
    create_action_token,
    get_verification_deadline,
    utcnow,
)
from app.services.email_service import send_action_email
from app.services.system_settings_service import get_or_create_system_settings


router = APIRouter(prefix="/users", tags=["users"])


def _serialize_user(user: User) -> UserResponse:
    return UserResponse.model_validate({
        **{field: getattr(user, field) for field in (
            "id",
            "email",
            "full_name",
            "role",
            "is_active",
            "created_at",
            "email_verified_at",
            "email_verification_deadline_at",
            "pending_email",
            "pending_email_requested_at",
            "pending_email_deadline_at",
        )},
        "email_is_verified": user.email_verified_at is not None,
    })


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cleanup_expired_security_state(db)
    db.refresh(current_user)
    return _serialize_user(current_user)


@router.post("/me/resend-email-verification", response_model=MessageResponse)
def resend_email_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    runtime_settings = get_or_create_system_settings(db)

    if current_user.pending_email:
        action_type = EMAIL_CHANGE_ACTION
        target_email = current_user.pending_email
        current_user.pending_email_requested_at = utcnow()
        current_user.pending_email_deadline_at = get_verification_deadline()
    else:
        if current_user.email_verified_at is not None:
            raise HTTPException(status_code=400, detail="Адрес электронной почты уже подтверждён.")
        action_type = EMAIL_VERIFICATION_ACTION
        target_email = current_user.email
        current_user.email_verification_deadline_at = get_verification_deadline()

    token = create_action_token(
        db,
        user=current_user,
        action_type=action_type,
        expires_at=get_verification_deadline(),
        target_email=target_email,
        requested_by_ip=request.client.host if request.client else None,
    )
    send_action_email(runtime_settings, user=current_user, action_type=action_type, token=token, target_email=target_email)
    db.commit()
    return MessageResponse(message="Письмо с подтверждением отправлено повторно.")


@router.post("/me/change-email", response_model=MessageResponse)
def request_email_change(
    payload: EmailChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)

    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Текущий пароль указан неверно.")
    if payload.new_email == current_user.email:
        raise HTTPException(status_code=400, detail="Новый адрес должен отличаться от текущего.")

    existing_user = db.scalar(
        select(User).where(
            or_(User.email == payload.new_email, User.pending_email == payload.new_email),
            User.id != current_user.id,
        )
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким адресом уже существует")

    runtime_settings = get_or_create_system_settings(db)
    current_user.pending_email = payload.new_email
    current_user.pending_email_requested_at = utcnow()
    current_user.pending_email_deadline_at = get_verification_deadline()

    token = create_action_token(
        db,
        user=current_user,
        action_type=EMAIL_CHANGE_ACTION,
        expires_at=get_verification_deadline(),
        target_email=payload.new_email,
        requested_by_ip=request.client.host if request.client else None,
    )
    send_action_email(runtime_settings, user=current_user, action_type=EMAIL_CHANGE_ACTION, token=token, target_email=payload.new_email)
    db.commit()
    return MessageResponse(message="Письмо для подтверждения нового адреса отправлено.")


@router.post("/me/password-reset-email", response_model=MessageResponse)
def send_password_reset_email_from_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.account_security_service import PASSWORD_RESET_ACTION, create_action_token, get_password_reset_deadline

    cleanup_expired_security_state(db)

    if current_user.email_verified_at is None:
        raise HTTPException(status_code=400, detail="Сначала подтвердите адрес электронной почты.")

    runtime_settings = get_or_create_system_settings(db)
    token = create_action_token(
        db,
        user=current_user,
        action_type=PASSWORD_RESET_ACTION,
        expires_at=get_password_reset_deadline(),
        target_email=current_user.email,
        requested_by_ip=request.client.host if request.client else None,
    )
    send_action_email(runtime_settings, user=current_user, action_type=PASSWORD_RESET_ACTION, token=token, target_email=current_user.email)
    db.commit()
    return MessageResponse(message="Письмо для смены пароля отправлено на подтверждённый адрес.")


@router.get("", response_model=list[UserResponse])
def list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    return [_serialize_user(user) for user in db.scalars(select(User).order_by(User.created_at.desc())).all()]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    existing_user = db.scalar(select(User).where(or_(User.email == payload.email, User.pending_email == payload.email)))
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким адресом уже существует")

    runtime_settings = get_or_create_system_settings(db)
    user = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        email_verified_at=None,
        email_verification_deadline_at=get_verification_deadline(),
    )
    db.add(user)
    db.flush()

    token = create_action_token(
        db,
        user=user,
        action_type=EMAIL_VERIFICATION_ACTION,
        expires_at=get_verification_deadline(),
        target_email=user.email,
        requested_by_ip=request.client.host if request.client else None,
    )
    send_action_email(runtime_settings, user=user, action_type=EMAIL_VERIFICATION_ACTION, token=token, target_email=user.email)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    existing_user = db.scalar(select(User).where(or_(User.email == payload.email, User.pending_email == payload.email), User.id != user_id))
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким адресом уже существует")

    if current_user.id == user.id and payload.role != 'admin':
        raise HTTPException(status_code=400, detail='Администратор не может снять роль администратора у самого себя')

    if current_user.id == user.id and not payload.is_active:
        raise HTTPException(status_code=400, detail='Администратор не может отключить свой аккаунт')

    runtime_settings = get_or_create_system_settings(db)
    email_changed = user.email != payload.email

    user.full_name = payload.full_name.strip()
    user.role = payload.role
    user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)

    if email_changed:
        user.email = payload.email
        user.email_verified_at = None
        user.email_verification_deadline_at = get_verification_deadline()
        user.pending_email = None
        user.pending_email_requested_at = None
        user.pending_email_deadline_at = None

        token = create_action_token(
            db,
            user=user,
            action_type=EMAIL_VERIFICATION_ACTION,
            expires_at=get_verification_deadline(),
            target_email=user.email,
            requested_by_ip=request.client.host if request.client else None,
        )
        send_action_email(runtime_settings, user=user, action_type=EMAIL_VERIFICATION_ACTION, token=token, target_email=user.email)

    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cleanup_expired_security_state(db)
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if current_user.id == user.id:
        raise HTTPException(status_code=400, detail='Администратор не может удалить свой аккаунт')

    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.services.account_security_service import cleanup_expired_security_state, ensure_user_not_expired


bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить данные доступа",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token: str | None = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    else:
        token = request.cookies.get(settings.access_token_cookie_name)

    if not token:
        raise unauthorized

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        token_type = payload.get("type")
        if subject is None or token_type != "access":
            raise unauthorized
        user_id = int(subject)
    except (JWTError, ValueError):
        raise unauthorized

    cleanup_expired_security_state(db)
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise unauthorized
    ensure_user_not_expired(db, user)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Учётная запись пользователя отключена")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return current_user

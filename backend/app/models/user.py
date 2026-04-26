from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="student")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verification_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pending_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pending_email_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pending_email_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    support_conversations = relationship(
        "SupportConversation",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="SupportConversation.user_id",
    )
    assigned_support_conversations = relationship(
        "SupportConversation",
        back_populates="assigned_admin",
        foreign_keys="SupportConversation.assigned_admin_id",
    )
    support_messages = relationship("SupportMessage", back_populates="author", cascade="all, delete-orphan")
    auth_action_tokens = relationship("AuthActionToken", back_populates="user", cascade="all, delete-orphan")

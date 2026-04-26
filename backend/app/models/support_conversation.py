from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SupportConversation(Base):
    __tablename__ = "support_conversations"
    __table_args__ = (
        Index(
            "uq_support_conversations_one_open_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'open'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    assigned_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    last_message_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    unread_for_admin: Mapped[int] = mapped_column(Integer, default=0)
    unread_for_user: Mapped[int] = mapped_column(Integer, default=0)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="support_conversations", foreign_keys=[user_id])
    assigned_admin = relationship("User", back_populates="assigned_support_conversations", foreign_keys=[assigned_admin_id])
    messages = relationship(
        "SupportMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="SupportMessage.created_at.asc()",
    )

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProjectComponent(Base):
    __tablename__ = "project_components"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255))
    component_type: Mapped[str] = mapped_column(String(50), default="internal_component")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    endpoint_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    responsible_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criticality_level: Mapped[str] = mapped_column(String(50), default="important")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    project = relationship("Project", back_populates="components")

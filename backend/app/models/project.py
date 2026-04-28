from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_type: Mapped[str] = mapped_column(String(50), default="api")
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    environment_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    system_owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    owner = relationship("User", back_populates="projects")
    settings = relationship(
        "ProjectSettings",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
    )
    tests = relationship(
        "Test",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    components = relationship(
        "ProjectComponent",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    @property
    def tests_count(self) -> int:
        return len(self.tests or [])

    @property
    def components_count(self) -> int:
        return len(self.components or [])

    @property
    def internal_components_count(self) -> int:
        return len([item for item in (self.components or []) if item.component_type == "internal_component"])

    @property
    def external_integrations_count(self) -> int:
        return len([item for item in (self.components or []) if item.component_type == "external_integration"])

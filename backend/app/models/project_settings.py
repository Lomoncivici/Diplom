from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProjectSettings(Base):
    __tablename__ = "project_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    project_type: Mapped[str] = mapped_column(String(50), default="api")
    test_type: Mapped[str] = mapped_column(String(50), default="load")
    environment: Mapped[str] = mapped_column(String(50), default="local")

    target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_port: Mapped[str | None] = mapped_column(String(20), nullable=True)

    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)

    virtual_users: Mapped[int] = mapped_column(Integer, default=50)
    duration: Mapped[str] = mapped_column(String(50), default="5m")
    ramp_up: Mapped[str] = mapped_column(String(50), default="30s")
    ramp_down: Mapped[str] = mapped_column(String(50), default="15s")
    timeout: Mapped[str] = mapped_column(String(50), default="30s")
    repeat_count: Mapped[int] = mapped_column(Integer, default=1)

    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    prometheus_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    grafana_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    max_avg_response_ms: Mapped[int] = mapped_column(Integer, default=500)
    max_p95_ms: Mapped[int] = mapped_column(Integer, default=1000)
    max_error_rate: Mapped[int] = mapped_column(Integer, default=2)
    min_throughput: Mapped[int] = mapped_column(Integer, default=100)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    project = relationship("Project", back_populates="settings")
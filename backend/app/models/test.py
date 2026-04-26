from datetime import datetime

from sqlalchemy import JSON
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(primary_key=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_entity: Mapped[str | None] = mapped_column(String(255), nullable=True)

    project_type: Mapped[str] = mapped_column(String(50), default="api")
    test_type: Mapped[str] = mapped_column(String(50), default="load")
    environment: Mapped[str] = mapped_column(String(50), default="local")

    target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_port: Mapped[str | None] = mapped_column(String(50), nullable=True)

    success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)

    virtual_users: Mapped[int] = mapped_column(Integer, default=50)
    duration: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ramp_up: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ramp_down: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timeout: Mapped[str | None] = mapped_column(String(50), nullable=True)
    repeat_count: Mapped[int] = mapped_column(Integer, default=1)

    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    prometheus_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    grafana_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    max_avg_response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_p95_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_error_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_throughput: Mapped[int | None] = mapped_column(Integer, nullable=True)

    request_method: Mapped[str] = mapped_column(String(16), default="GET")
    request_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_headers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    query_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    request_body: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    expected_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    scenario_type: Mapped[str] = mapped_column(String(50), default="http")
    script_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(50), default="draft")

    last_run_activity: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    project = relationship("Project", back_populates="tests")
    runs = relationship("TestRun", back_populates="test", cascade="all, delete-orphan")
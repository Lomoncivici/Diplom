from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    scenario_id: Mapped[int] = mapped_column(
        ForeignKey("test_scenarios.id", ondelete="CASCADE"),
        index=True,
    )

    status: Mapped[str] = mapped_column(String(50), default="created")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs: Mapped[str | None] = mapped_column(Text, nullable=True)

    avg_response_ms: Mapped[int | None] = mapped_column(nullable=True)
    p95_response_ms: Mapped[int | None] = mapped_column(nullable=True)
    error_rate: Mapped[int | None] = mapped_column(nullable=True)
    throughput: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    scenario = relationship("TestScenario", back_populates="runs")
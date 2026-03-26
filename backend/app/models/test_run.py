from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(primary_key=True)

    test_id: Mapped[int] = mapped_column(
        ForeignKey("tests.id", ondelete="CASCADE"),
        index=True,
    )

    status: Mapped[str] = mapped_column(String(50), default="created")

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs: Mapped[str | None] = mapped_column(Text, nullable=True)

    avg_response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    p95_response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    throughput: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    requests_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requests_success: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requests_failed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    test = relationship("Test", back_populates="runs")
from datetime import datetime

from pydantic import BaseModel


class ThresholdResult(BaseModel):
    key: str
    label: str
    operator: str
    actual: float | None
    target: float | None
    unit: str
    passed: bool


class TestRunCreate(BaseModel):
    summary: str | None = None


class TestRunResponse(BaseModel):
    id: int
    test_id: int
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    summary: str | None
    logs: str | None
    avg_response_ms: float | None
    p95_response_ms: float | None
    error_rate: float | None
    throughput: float | None
    created_at: datetime
    requests_total: int | None
    requests_success: int | None
    requests_failed: int | None
    threshold_passed: bool | None = None
    threshold_results: list[ThresholdResult] | None = None

    class Config:
        from_attributes = True

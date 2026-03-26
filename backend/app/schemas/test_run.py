from datetime import datetime
from pydantic import BaseModel


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
    avg_response_ms: int | None
    p95_response_ms: int | None
    error_rate: int | None
    throughput: int | None
    created_at: datetime

    requests_total:int | None
    requests_success:int | None
    requests_failed: int | None

    class Config:
        from_attributes = True
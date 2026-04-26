from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None


class ProjectOwnerResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    owner_id: int
    created_at: datetime
    owner: ProjectOwnerResponse | None = None

    class Config:
        from_attributes = True


class ProjectAnalyticsTotals(BaseModel):
    runs_count: int
    successful_runs: int
    failed_runs: int
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_ms: float | None
    p95_response_ms: float | None
    error_rate: float | None
    throughput: float | None
    last_run_at: datetime | None


class ProjectTestAnalytics(BaseModel):
    test_id: int
    test_name: str
    runs_count: int
    successful_runs: int
    failed_runs: int
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_ms: float | None
    p95_response_ms: float | None
    error_rate: float | None
    throughput: float | None
    last_run_at: datetime | None


class ProjectAnalyticsResponse(BaseModel):
    project_id: int
    project_name: str
    owner: ProjectOwnerResponse | None = None
    tests_count: int
    totals: ProjectAnalyticsTotals
    tests: list[ProjectTestAnalytics]

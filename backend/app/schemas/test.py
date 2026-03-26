from datetime import datetime
from pydantic import BaseModel, Field


class TestBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    goal: str | None = None
    target_entity: str | None = None

    project_type: str = "api"
    test_type: str = "load"
    environment: str = "local"

    target_url: str | None = None
    target_port: str | None = None
    success_criteria: str | None = None

    virtual_users: int = 50
    duration: str | None = None
    ramp_up: str | None = None
    ramp_down: str | None = None
    timeout: str | None = None
    repeat_count: int = 1

    monitoring_enabled: bool = False
    prometheus_url: str | None = None
    grafana_url: str | None = None

    max_avg_response_ms: int | None = None
    max_p95_ms: int | None = None
    max_error_rate: int | None = None
    min_throughput: int | None = None

    scenario_type: str = "http"
    script_content: str | None = None
    status: str = "draft"

    request_method: str = "GET"
    request_path: str | None = None
    request_headers: dict | None = None
    query_params: dict | None = None
    request_body: dict | None = None

    expected_status_code: int | None = 200
    expected_response_time_ms: int | None = None


class TestCreate(TestBase):
    pass


class TestUpdate(TestBase):
    pass


class TestResponse(TestBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
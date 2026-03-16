from datetime import datetime
from pydantic import BaseModel


class ProjectSettingsCreate(BaseModel):
    project_type: str = "api"
    test_type: str = "load"
    environment: str = "local"
    target_url: str | None = None
    target_port: str | None = None
    goal: str | None = None
    success_criteria: str | None = None
    virtual_users: int = 50
    duration: str = "5m"
    ramp_up: str = "30s"
    ramp_down: str = "15s"
    timeout: str = "30s"
    repeat_count: int = 1
    monitoring_enabled: bool = True
    prometheus_url: str | None = None
    grafana_url: str | None = None
    max_avg_response_ms: int = 500
    max_p95_ms: int = 1000
    max_error_rate: int = 2
    min_throughput: int = 100


class ProjectSettingsUpdate(ProjectSettingsCreate):
    pass


class ProjectSettingsResponse(ProjectSettingsCreate):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
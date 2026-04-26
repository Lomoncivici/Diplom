from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.validation import (
    validate_duration,
    validate_http_url,
    validate_non_negative_int,
    validate_port,
)


class ProjectSettingsCreate(BaseModel):
    project_type: str = Field(default="api", max_length=50)
    test_type: str = Field(default="load", max_length=50)
    environment: str = Field(default="local", max_length=50)
    target_url: str | None = None
    target_port: str | None = None
    goal: str | None = Field(default=None, max_length=5000)
    success_criteria: str | None = Field(default=None, max_length=5000)
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

    @field_validator("target_url")
    @classmethod
    def validate_target_url_value(cls, value: str | None) -> str | None:
        return validate_http_url(value, field_name="Target URL")

    @field_validator("prometheus_url", "grafana_url")
    @classmethod
    def validate_monitoring_url_value(cls, value: str | None) -> str | None:
        return validate_http_url(value, field_name="Monitoring URL")

    @field_validator("target_port")
    @classmethod
    def validate_port_value(cls, value: str | None) -> str | None:
        return validate_port(value)

    @field_validator("duration")
    @classmethod
    def validate_duration_value(cls, value: str) -> str:
        return validate_duration(value, field_name="Duration", allow_none=False) or "5m"

    @field_validator("ramp_up")
    @classmethod
    def validate_ramp_up_value(cls, value: str) -> str:
        return validate_duration(value, field_name="Ramp up", allow_none=False) or "30s"

    @field_validator("ramp_down")
    @classmethod
    def validate_ramp_down_value(cls, value: str) -> str:
        return validate_duration(value, field_name="Ramp down", allow_none=False) or "15s"

    @field_validator("timeout")
    @classmethod
    def validate_timeout_value(cls, value: str) -> str:
        return validate_duration(value, field_name="Timeout", allow_none=False) or "30s"

    @field_validator("virtual_users")
    @classmethod
    def validate_virtual_users_value(cls, value: int) -> int:
        return validate_non_negative_int(value, field_name="Virtual users", minimum=1, maximum=1000) or 1

    @field_validator("repeat_count")
    @classmethod
    def validate_repeat_count_value(cls, value: int) -> int:
        return validate_non_negative_int(value, field_name="Repeat count", minimum=1, maximum=500) or 1

    @field_validator("max_avg_response_ms", "max_p95_ms", "max_error_rate", "min_throughput")
    @classmethod
    def validate_metric_values(cls, value: int) -> int:
        return validate_non_negative_int(value, field_name="Metric", minimum=0, maximum=1_000_000) or 0


class ProjectSettingsUpdate(ProjectSettingsCreate):
    pass


class ProjectSettingsResponse(ProjectSettingsCreate):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

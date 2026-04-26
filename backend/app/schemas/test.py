from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.validation import (
    validate_duration,
    validate_generic_json_map,
    validate_headers,
    validate_http_url,
    validate_non_negative_int,
    validate_port,
    validate_request_method,
    validate_status_code,
)


class ActivityPoint(BaseModel):
    second: float
    label: str
    active_users: int
    requests_sent: int


class TestFields(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    goal: str | None = Field(default=None, max_length=5000)
    target_entity: str | None = Field(default=None, max_length=255)

    project_type: str = Field(default="api", max_length=50)
    test_type: str = Field(default="load", max_length=50)
    environment: str = Field(default="local", max_length=50)

    target_url: str | None = None
    target_port: str | None = None
    success_criteria: str | None = Field(default=None, max_length=5000)

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

    scenario_type: str = Field(default="http", max_length=50)
    script_content: str | None = Field(default=None, max_length=50_000)
    status: str = Field(default="draft", max_length=50)

    request_method: str = "GET"
    request_path: str | None = Field(default=None, max_length=500)
    request_headers: dict | None = None
    query_params: dict | None = None
    request_body: dict | None = None

    expected_status_code: int | None = 200
    expected_response_time_ms: int | None = None


class TestCreate(TestFields):
    @field_validator("target_url")
    @classmethod
    def validate_target_url_value(cls, value: str | None) -> str | None:
        return validate_http_url(value, field_name="Адрес сервиса")

    @field_validator("prometheus_url", "grafana_url")
    @classmethod
    def validate_monitoring_url_value(cls, value: str | None) -> str | None:
        return validate_http_url(value, field_name="Адрес мониторинга")

    @field_validator("target_port")
    @classmethod
    def validate_port_value(cls, value: str | None) -> str | None:
        return validate_port(value)

    @field_validator("duration")
    @classmethod
    def validate_duration_value(cls, value: str | None) -> str | None:
        return validate_duration(value, field_name="Длительность")

    @field_validator("ramp_up")
    @classmethod
    def validate_ramp_up_value(cls, value: str | None) -> str | None:
        return validate_duration(value, field_name="Плавный запуск")

    @field_validator("ramp_down")
    @classmethod
    def validate_ramp_down_value(cls, value: str | None) -> str | None:
        return validate_duration(value, field_name="Плавное завершение")

    @field_validator("timeout")
    @classmethod
    def validate_timeout_value(cls, value: str | None) -> str | None:
        return validate_duration(value, field_name="Тайм-аут")

    @field_validator("request_method")
    @classmethod
    def validate_request_method_value(cls, value: str) -> str:
        return validate_request_method(value)

    @field_validator("expected_status_code")
    @classmethod
    def validate_expected_status_code_value(cls, value: int | None) -> int | None:
        return validate_status_code(value)

    @field_validator("virtual_users")
    @classmethod
    def validate_virtual_users_value(cls, value: int) -> int:
        return validate_non_negative_int(value, field_name="Виртуальные пользователи", minimum=1, maximum=1000) or 1

    @field_validator("repeat_count")
    @classmethod
    def validate_repeat_count_value(cls, value: int) -> int:
        return validate_non_negative_int(value, field_name="Количество повторов", minimum=1, maximum=500) or 1

    @field_validator(
        "max_avg_response_ms",
        "max_p95_ms",
        "max_error_rate",
        "min_throughput",
        "expected_response_time_ms",
    )
    @classmethod
    def validate_metric_values(cls, value: int | None) -> int | None:
        return validate_non_negative_int(value, field_name="Метрика", minimum=0, maximum=1_000_000)

    @field_validator("request_headers")
    @classmethod
    def validate_request_headers_value(cls, value: dict | None) -> dict | None:
        return validate_headers(value)

    @field_validator("query_params", "request_body")
    @classmethod
    def validate_json_maps(cls, value: dict | None) -> dict | None:
        return validate_generic_json_map(value, field_name="Данные запроса")


class TestUpdate(TestCreate):
    pass


class TestResponse(TestFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    last_run_activity: list[ActivityPoint] | None = None
    created_at: datetime
    updated_at: datetime

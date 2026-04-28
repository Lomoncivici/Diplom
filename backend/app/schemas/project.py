from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.validation import validate_http_url


class ProjectFields(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    system_type: str = Field(default="api", max_length=50)
    base_url: str | None = None
    environment_name: str | None = Field(default=None, max_length=120)
    system_owner: str | None = Field(default=None, max_length=255)

    @field_validator("base_url")
    @classmethod
    def validate_base_url_value(cls, value: str | None) -> str | None:
        return validate_http_url(value, field_name="Базовый адрес системы")

    @field_validator("name")
    @classmethod
    def validate_name_value(cls, value: str) -> str:
        text = value.strip()
        if len(text) < 2:
            raise ValueError("Название системы должно содержать минимум два символа")
        if len(text) > 255:
            raise ValueError("Название системы не должно быть длиннее 255 символов")
        return text

    @field_validator("description", "environment_name", "system_owner")
    @classmethod
    def strip_optional_text_value(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None

    @field_validator("system_type")
    @classmethod
    def normalize_system_type(cls, value: str) -> str:
        text = value.strip().lower()
        return text or "api"


class ProjectCreate(ProjectFields):
    pass


class ProjectUpdate(ProjectFields):
    pass


class ProjectOwnerResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(ProjectFields):
    id: int
    owner_id: int
    created_at: datetime
    tests_count: int | None = None
    components_count: int | None = None
    internal_components_count: int | None = None
    external_integrations_count: int | None = None
    owner: ProjectOwnerResponse | None = None

    model_config = ConfigDict(from_attributes=True)


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

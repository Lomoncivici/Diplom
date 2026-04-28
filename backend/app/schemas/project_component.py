from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.validation import validate_http_url

ALLOWED_COMPONENT_TYPES = {"internal_component", "external_integration"}
ALLOWED_CRITICALITY_LEVELS = {"critical", "important", "optional"}


class ProjectComponentFields(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    component_type: str = Field(default="internal_component", max_length=50)
    description: str | None = Field(default=None, max_length=5000)
    endpoint_url: str | None = None
    responsible_name: str | None = Field(default=None, max_length=255)
    criticality_level: str = Field(default="important", max_length=50)

    @field_validator("name")
    @classmethod
    def validate_name_value(cls, value: str) -> str:
        text = value.strip()
        if len(text) < 2:
            raise ValueError("Название компонента должно содержать минимум два символа")
        if len(text) > 255:
            raise ValueError("Название компонента не должно быть длиннее 255 символов")
        return text

    @field_validator("description", "responsible_name")
    @classmethod
    def strip_optional_text_value(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None

    @field_validator("endpoint_url")
    @classmethod
    def validate_endpoint_url_value(cls, value: str | None) -> str | None:
        return validate_http_url(value, field_name="Адрес компонента")

    @field_validator("component_type")
    @classmethod
    def normalize_component_type(cls, value: str) -> str:
        text = value.strip().lower()
        if text not in ALLOWED_COMPONENT_TYPES:
            raise ValueError("Тип компонента должен быть внутренним компонентом системы или внешней интеграцией")
        return text

    @field_validator("criticality_level")
    @classmethod
    def normalize_criticality_level(cls, value: str) -> str:
        text = value.strip().lower()
        if text not in ALLOWED_CRITICALITY_LEVELS:
            raise ValueError("Критичность должна быть критичной, важной или дополнительной")
        return text


class ProjectComponentCreate(ProjectComponentFields):
    pass


class ProjectComponentUpdate(ProjectComponentFields):
    pass


class ProjectComponentResponse(ProjectComponentFields):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

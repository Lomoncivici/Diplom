from datetime import datetime

from pydantic import BaseModel, Field


class DatabaseRestoreRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=2, max_length=20_000_000)


class DatabaseRestoreResponse(BaseModel):
    message: str
    restored_table_counts: dict[str, int]
    automatic_backup_file_name: str
    automatic_backup_created_at: datetime


class HealthStatusResponse(BaseModel):
    status: str
    technical_works_active: bool
    technical_works_message: str | None = None
    technical_works_operation: str | None = None

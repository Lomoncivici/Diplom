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
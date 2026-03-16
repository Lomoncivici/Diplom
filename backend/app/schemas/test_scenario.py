from datetime import datetime
from pydantic import BaseModel, Field


class TestScenarioCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    scenario_type: str = "http"
    script_content: str


class TestScenarioUpdate(TestScenarioCreate):
    pass


class TestScenarioResponse(TestScenarioCreate):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True
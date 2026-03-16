from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.project_access import get_project_or_403
from app.dependencies import get_current_user, get_db
from app.models.test_scenario import TestScenario
from app.models.user import User
from app.schemas.test_scenario import (
    TestScenarioCreate,
    TestScenarioResponse,
    TestScenarioUpdate,
)

router = APIRouter(prefix="/projects", tags=["test-scenarios"])


@router.get("/{project_id}/scenarios", response_model=list[TestScenarioResponse])
def list_project_scenarios(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)

    stmt = (
        select(TestScenario)
        .where(TestScenario.project_id == project_id)
        .order_by(TestScenario.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.post("/{project_id}/scenarios", response_model=TestScenarioResponse)
def create_project_scenario(
    project_id: int,
    payload: TestScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)

    scenario = TestScenario(
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        scenario_type=payload.scenario_type,
        script_content=payload.script_content,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.get("/scenarios/{scenario_id}", response_model=TestScenarioResponse)
def get_scenario(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scenario = db.scalar(select(TestScenario).where(TestScenario.id == scenario_id))
    project = get_project_or_403(scenario.project_id, current_user, db)
    return scenario


@router.put("/scenarios/{scenario_id}", response_model=TestScenarioResponse)
def update_scenario(
    scenario_id: int,
    payload: TestScenarioUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scenario = db.scalar(select(TestScenario).where(TestScenario.id == scenario_id))
    get_project_or_403(scenario.project_id, current_user, db)

    scenario.name = payload.name
    scenario.description = payload.description
    scenario.scenario_type = payload.scenario_type
    scenario.script_content = payload.script_content

    db.commit()
    db.refresh(scenario)
    return scenario
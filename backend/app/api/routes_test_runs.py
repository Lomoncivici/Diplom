from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.project_access import get_project_or_403
from app.dependencies import get_current_user, get_db
from app.models.test_run import TestRun
from app.models.test_scenario import TestScenario
from app.models.user import User
from app.schemas.test_run import TestRunCreate, TestRunResponse

router = APIRouter(prefix="/scenarios", tags=["test-runs"])


@router.get("/{scenario_id}/runs", response_model=list[TestRunResponse])
def list_scenario_runs(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scenario = db.scalar(select(TestScenario).where(TestScenario.id == scenario_id))
    get_project_or_403(scenario.project_id, current_user, db)

    stmt = (
        select(TestRun)
        .where(TestRun.scenario_id == scenario_id)
        .order_by(TestRun.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.post("/{scenario_id}/runs", response_model=TestRunResponse)
def create_scenario_run(
    scenario_id: int,
    payload: TestRunCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scenario = db.scalar(select(TestScenario).where(TestScenario.id == scenario_id))
    get_project_or_403(scenario.project_id, current_user, db)

    started_at = datetime.now(timezone.utc)

    run = TestRun(
        scenario_id=scenario_id,
        status="success",
        started_at=started_at,
        finished_at=datetime.now(timezone.utc),
        summary=payload.summary or "Тестовый запуск выполнен успешно.",
        logs="Mock test run completed on backend.",
        avg_response_ms=320,
        p95_response_ms=540,
        error_rate=1,
        throughput=180,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.get("/runs/{run_id}", response_model=TestRunResponse)
def get_run(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.scalar(select(TestRun).where(TestRun.id == run_id))
    scenario = db.scalar(select(TestScenario).where(TestScenario.id == run.scenario_id))
    get_project_or_403(scenario.project_id, current_user, db)
    return run
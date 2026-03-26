from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.project_access import get_project_or_403
from app.dependencies import get_current_user, get_db
from app.models.test import Test
from app.models.test_run import TestRun
from app.models.user import User
from app.schemas.test_run import TestRunCreate, TestRunResponse
from app.services.api_test_runner import run_api_test

router = APIRouter(tags=["test-runs"])


@router.get("/tests/{test_id}/runs", response_model=list[TestRunResponse])
def list_test_runs(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.scalar(select(Test).where(Test.id == test_id))
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    get_project_or_403(test.project_id, current_user, db)

    stmt = (
        select(TestRun)
        .where(TestRun.test_id == test_id)
        .order_by(TestRun.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.post("/tests/{test_id}/runs", response_model=TestRunResponse)
async def create_test_run(
    test_id: int,
    payload: TestRunCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.scalar(select(Test).where(Test.id == test_id))
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    get_project_or_403(test.project_id, current_user, db)

    started_at = datetime.now(timezone.utc)

    run = TestRun(
        test_id=test_id,
        status="running",
        started_at=started_at,
        summary=payload.summary or "Запуск теста начат.",
        logs="",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    result = await run_api_test(test)

    run.status = result["status"]
    run.finished_at = datetime.now(timezone.utc)
    run.summary = result["summary"]
    run.logs = result["logs"]
    run.avg_response_ms = result["avg_response_ms"]
    run.p95_response_ms = result["p95_response_ms"]
    run.error_rate = result["error_rate"]
    run.throughput = result["throughput"]
    run.requests_total = result["requests_total"]
    run.requests_success = result["requests_success"]
    run.requests_failed = result["requests_failed"]

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
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    test = db.scalar(select(Test).where(Test.id == run.test_id))
    get_project_or_403(test.project_id, current_user, db)
    return run
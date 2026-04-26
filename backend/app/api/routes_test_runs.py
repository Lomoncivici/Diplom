from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.project_access import get_project_or_403
from app.core.database import SessionLocal
from app.dependencies import get_current_user, get_db
from app.models.test import Test
from app.models.test_run import TestRun
from app.models.user import User
from app.schemas.test_run import TestRunCreate, TestRunResponse
from app.services.api_test_runner import run_api_test
from app.services.system_settings_service import get_or_create_system_settings

router = APIRouter(tags=["test-runs"])
ACTIVE_RUN_STATUSES = {"queued", "running"}


async def execute_test_run_in_background(run_id: int) -> None:
    db = SessionLocal()
    try:
        run = db.scalar(select(TestRun).where(TestRun.id == run_id))
        if not run:
            return

        test = db.scalar(select(Test).where(Test.id == run.test_id))
        if not test:
            run.status = "failed"
            run.finished_at = datetime.now(timezone.utc)
            run.summary = "Запуск остановлен: тест не найден."
            run.logs = "Тест был удалён до начала выполнения."
            db.commit()
            return

        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        run.summary = "Тест выполняется. История запусков обновляется автоматически."
        run.logs = "Запуск теста начат."
        test.status = "running"
        db.commit()

        runtime_settings = get_or_create_system_settings(db)

        try:
            result = await run_api_test(test, runtime_settings)
        except HTTPException as exc:
            run.status = "failed"
            run.finished_at = datetime.now(timezone.utc)
            run.summary = "Тест не был запущен из-за ошибки конфигурации или политики безопасности."
            run.logs = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            test.status = "failed"
            db.commit()
            return
        except Exception:
            run.status = "failed"
            run.finished_at = datetime.now(timezone.utc)
            run.summary = "Внутренняя ошибка при выполнении теста."
            run.logs = "Непредвиденная внутренняя ошибка."
            test.status = "failed"
            db.commit()
            return

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
        run.threshold_passed = result["threshold_passed"]
        run.threshold_results = result["threshold_results"]

        test.status = result["status"]
        test.last_run_activity = result["activity_timeline"]

        db.commit()
    finally:
        db.close()


@router.get("/tests/{test_id}/runs", response_model=list[TestRunResponse])
def list_test_runs(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.scalar(select(Test).where(Test.id == test_id))
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    get_project_or_403(test.project_id, current_user, db)

    stmt = select(TestRun).where(TestRun.test_id == test_id).order_by(TestRun.created_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/tests/{test_id}/runs", response_model=TestRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_test_run(
    test_id: int,
    payload: TestRunCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.scalar(select(Test).where(Test.id == test_id))
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    get_project_or_403(test.project_id, current_user, db)

    active_run = db.scalar(
        select(TestRun)
        .where(TestRun.test_id == test_id, TestRun.status.in_(ACTIVE_RUN_STATUSES))
        .order_by(TestRun.created_at.desc())
    )
    if active_run:
        raise HTTPException(
            status_code=409,
            detail="Для этого теста уже выполняется запуск. Дождитесь его завершения.",
        )

    run = TestRun(
        test_id=test_id,
        status="queued",
        started_at=None,
        summary=payload.summary or "Запуск поставлен в очередь.",
        logs="Ожидание начала выполнения.",
    )
    db.add(run)
    test.status = "queued"
    db.commit()
    db.refresh(run)

    asyncio.create_task(execute_test_run_in_background(run.id))
    return run


@router.get("/runs/{run_id}", response_model=TestRunResponse)
def get_run(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.scalar(select(TestRun).where(TestRun.id == run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Запуск не найден")

    test = db.scalar(select(Test).where(Test.id == run.test_id))
    get_project_or_403(test.project_id, current_user, db)
    return run

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from app.api.project_access import get_project_or_403
from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import Project
from app.models.project_settings import ProjectSettings
from app.models.test import Test
from app.models.test_run import TestRun
from app.models.user import User
from app.schemas.project import (
    ProjectAnalyticsResponse,
    ProjectAnalyticsTotals,
    ProjectCreate,
    ProjectResponse,
    ProjectTestAnalytics,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Project).options(joinedload(Project.owner), joinedload(Project.tests), joinedload(Project.components)).order_by(Project.created_at.desc())
    if current_user.role != "admin":
        stmt = stmt.where(Project.owner_id == current_user.id)
    return list(db.scalars(stmt).unique().all())


@router.post("", response_model=ProjectResponse)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        name=payload.name,
        description=payload.description,
        system_type=payload.system_type,
        base_url=payload.base_url,
        environment_name=payload.environment_name,
        system_owner=payload.system_owner,
        owner_id=current_user.id,
    )
    db.add(project)
    db.flush()

    settings = ProjectSettings(project_id=project.id)
    db.add(settings)

    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project_or_403(project_id, current_user, db)
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project_or_403(project_id, current_user, db)

    project.name = payload.name
    project.description = payload.description
    project.system_type = payload.system_type
    project.base_url = payload.base_url
    project.environment_name = payload.environment_name
    project.system_owner = payload.system_owner

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project_or_403(project_id, current_user, db)
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/analytics", response_model=ProjectAnalyticsResponse)
def get_project_analytics(
    project_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    project = db.scalar(
        select(Project)
        .options(joinedload(Project.owner), joinedload(Project.tests), joinedload(Project.components))
        .where(Project.id == project_id)
    )
    if not project:
        raise HTTPException(status_code=404, detail='Система не найдена')

    metrics_stmt = (
        select(
            Test.id.label('test_id'),
            Test.name.label('test_name'),
            func.count(TestRun.id).label('runs_count'),
            func.sum(case((TestRun.status == 'success', 1), else_=0)).label('successful_runs'),
            func.sum(case((TestRun.status != 'success', 1), else_=0)).label('failed_runs'),
            func.coalesce(func.sum(TestRun.requests_total), 0).label('total_requests'),
            func.coalesce(func.sum(TestRun.requests_success), 0).label('successful_requests'),
            func.coalesce(func.sum(TestRun.requests_failed), 0).label('failed_requests'),
            func.avg(TestRun.avg_response_ms).label('avg_response_ms'),
            func.avg(TestRun.p95_response_ms).label('p95_response_ms'),
            func.avg(TestRun.error_rate).label('error_rate'),
            func.avg(TestRun.throughput).label('throughput'),
            func.max(TestRun.created_at).label('last_run_at'),
        )
        .select_from(Test)
        .outerjoin(TestRun, TestRun.test_id == Test.id)
        .where(Test.project_id == project_id)
        .group_by(Test.id, Test.name)
        .order_by(Test.name.asc())
    )

    rows = db.execute(metrics_stmt).all()

    tests = []
    for row in rows:
        tests.append(
            ProjectTestAnalytics(
                test_id=row.test_id,
                test_name=row.test_name,
                runs_count=int(row.runs_count or 0),
                successful_runs=int(row.successful_runs or 0),
                failed_runs=int(row.failed_runs or 0),
                total_requests=int(row.total_requests or 0),
                successful_requests=int(row.successful_requests or 0),
                failed_requests=int(row.failed_requests or 0),
                avg_response_ms=float(row.avg_response_ms) if row.avg_response_ms is not None else None,
                p95_response_ms=float(row.p95_response_ms) if row.p95_response_ms is not None else None,
                error_rate=float(row.error_rate) if row.error_rate is not None else None,
                throughput=float(row.throughput) if row.throughput is not None else None,
                last_run_at=row.last_run_at,
            )
        )

    totals = ProjectAnalyticsTotals(
        runs_count=sum(item.runs_count for item in tests),
        successful_runs=sum(item.successful_runs for item in tests),
        failed_runs=sum(item.failed_runs for item in tests),
        total_requests=sum(item.total_requests for item in tests),
        successful_requests=sum(item.successful_requests for item in tests),
        failed_requests=sum(item.failed_requests for item in tests),
        avg_response_ms=(sum(item.avg_response_ms for item in tests if item.avg_response_ms is not None) / len([item for item in tests if item.avg_response_ms is not None])) if any(item.avg_response_ms is not None for item in tests) else None,
        p95_response_ms=(sum(item.p95_response_ms for item in tests if item.p95_response_ms is not None) / len([item for item in tests if item.p95_response_ms is not None])) if any(item.p95_response_ms is not None for item in tests) else None,
        error_rate=(sum(item.error_rate for item in tests if item.error_rate is not None) / len([item for item in tests if item.error_rate is not None])) if any(item.error_rate is not None for item in tests) else None,
        throughput=(sum(item.throughput for item in tests if item.throughput is not None) / len([item for item in tests if item.throughput is not None])) if any(item.throughput is not None for item in tests) else None,
        last_run_at=max((item.last_run_at for item in tests if item.last_run_at is not None), default=None),
    )

    return ProjectAnalyticsResponse(
        project_id=project.id,
        project_name=project.name,
        owner=project.owner,
        tests_count=len(project.tests),
        totals=totals,
        tests=tests,
    )

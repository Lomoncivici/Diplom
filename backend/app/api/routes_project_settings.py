from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.project_access import get_project_or_403
from app.dependencies import get_current_user, get_db
from app.models.project_settings import ProjectSettings
from app.models.user import User
from app.schemas.project_settings import (
    ProjectSettingsResponse,
    ProjectSettingsUpdate,
)

router = APIRouter(prefix="/projects", tags=["project-settings"])


@router.get("/{project_id}/settings", response_model=ProjectSettingsResponse)
def get_project_settings(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)
    settings = db.scalar(
        select(ProjectSettings).where(ProjectSettings.project_id == project_id)
    )
    return settings


@router.put("/{project_id}/settings", response_model=ProjectSettingsResponse)
def update_project_settings(
    project_id: int,
    payload: ProjectSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)

    settings = db.scalar(
        select(ProjectSettings).where(ProjectSettings.project_id == project_id)
    )

    for field, value in payload.model_dump().items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
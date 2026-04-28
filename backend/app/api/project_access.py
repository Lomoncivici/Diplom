from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.project import Project
from app.models.user import User


def get_project_or_403(project_id: int, current_user: User, db: Session) -> Project:
    project = db.scalar(select(Project).options(joinedload(Project.owner), joinedload(Project.tests), joinedload(Project.components)).where(Project.id == project_id))
    if project is None:
        raise HTTPException(status_code=404, detail="Система не найдена")

    if current_user.role != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    return project
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.project_access import get_project_or_403
from app.dependencies import get_current_user, get_db
from app.models.project_component import ProjectComponent
from app.models.user import User
from app.schemas.project_component import (
    ProjectComponentCreate,
    ProjectComponentResponse,
    ProjectComponentUpdate,
)

router = APIRouter(prefix="/projects/{project_id}/components", tags=["project-components"])



def _get_component_or_404(project_id: int, component_id: int, db: Session) -> ProjectComponent:
    component = db.scalar(
        select(ProjectComponent).where(
            ProjectComponent.project_id == project_id,
            ProjectComponent.id == component_id,
        )
    )
    if component is None:
        raise HTTPException(status_code=404, detail="Компонент системы не найден")
    return component


@router.get("", response_model=list[ProjectComponentResponse])
def list_project_components(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)
    stmt = (
        select(ProjectComponent)
        .where(ProjectComponent.project_id == project_id)
        .order_by(ProjectComponent.component_type.asc(), ProjectComponent.name.asc())
    )
    return list(db.scalars(stmt).all())


@router.post("", response_model=ProjectComponentResponse)
def create_project_component(
    project_id: int,
    payload: ProjectComponentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)
    component = ProjectComponent(project_id=project_id, **payload.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


@router.put("/{component_id}", response_model=ProjectComponentResponse)
def update_project_component(
    project_id: int,
    component_id: int,
    payload: ProjectComponentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)
    component = _get_component_or_404(project_id, component_id, db)

    component.name = payload.name
    component.component_type = payload.component_type
    component.description = payload.description
    component.endpoint_url = payload.endpoint_url
    component.responsible_name = payload.responsible_name
    component.criticality_level = payload.criticality_level

    db.commit()
    db.refresh(component)
    return component


@router.delete("/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_component(
    project_id: int,
    component_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)
    component = _get_component_or_404(project_id, component_id, db)
    db.delete(component)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

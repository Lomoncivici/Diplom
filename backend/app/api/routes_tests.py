from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.project_access import get_project_or_403
from app.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.test import Test
from app.models.user import User
from app.schemas.test import TestCreate, TestResponse, TestUpdate

router = APIRouter(tags=["tests"])


@router.get("/projects/{project_id}/tests", response_model=list[TestResponse])
def list_project_tests(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)

    stmt = (
        select(Test)
        .where(Test.project_id == project_id)
        .order_by(Test.updated_at.desc(), Test.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.post("/projects/{project_id}/tests", response_model=TestResponse)
def create_project_test(
    project_id: int,
    payload: TestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project_or_403(project_id, current_user, db)

    payload_data = payload.model_dump()
    payload_data["name"] = payload_data["name"].strip()
    if payload_data.get("description"):
        payload_data["description"] = payload_data["description"].strip()
    test = Test(project_id=project_id, **payload_data)
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


@router.get("/tests/{test_id}", response_model=TestResponse)
def get_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.scalar(select(Test).where(Test.id == test_id))
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    get_project_or_403(test.project_id, current_user, db)
    return test


@router.put("/tests/{test_id}", response_model=TestResponse)
def update_test(
    test_id: int,
    payload: TestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.scalar(select(Test).where(Test.id == test_id))
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    get_project_or_403(test.project_id, current_user, db)

    payload_data = payload.model_dump()
    payload_data["name"] = payload_data["name"].strip()
    if payload_data.get("description"):
        payload_data["description"] = payload_data["description"].strip()

    for field, value in payload_data.items():
        setattr(test, field, value)

    db.commit()
    db.refresh(test)
    return test


@router.delete("/tests/{test_id}", status_code=204)
def delete_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.scalar(select(Test).where(Test.id == test_id))
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    get_project_or_403(test.project_id, current_user, db)

    db.delete(test)
    db.commit()
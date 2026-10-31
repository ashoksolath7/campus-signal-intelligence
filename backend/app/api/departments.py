from typing import Any
from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, require_role
from app.schemas.department import DepartmentCreate, DepartmentPatch, DepartmentResponse
from app.services.departments import (
    create_department,
    get_department_by_id,
    list_departments,
    update_department,
)

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get(
    "",
    response_model=list[DepartmentResponse],
    summary="List campus departments",
    description="Returns all active and inactive departments for ticket routing.",
)
def get_departments(active_only: bool = False) -> list[DepartmentResponse]:
    items = list_departments(active_only=active_only)
    return [DepartmentResponse.model_validate(d) for d in items]


@router.get(
    "/{department_id}",
    response_model=DepartmentResponse,
    summary="Get department details",
)
def get_department(department_id: str) -> DepartmentResponse:
    dept = get_department_by_id(department_id)
    return DepartmentResponse.model_validate(dept)


@router.post(
    "",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new department",
    description="Registers a new department for complaint handling (Admin only).",
)
def post_department(
    payload: DepartmentCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> DepartmentResponse:
    require_role("admin")(current_user)
    created = create_department(data=payload, actor=current_user["name"])
    return DepartmentResponse.model_validate(created)


@router.patch(
    "/{department_id}",
    response_model=DepartmentResponse,
    summary="Update department status or details",
    description="Updates department head, email, or toggles active status (Admin only).",
)
def patch_department(
    department_id: str,
    payload: DepartmentPatch,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> DepartmentResponse:
    require_role("admin")(current_user)
    updated = update_department(department_id=department_id, patch=payload, actor=current_user["name"])
    return DepartmentResponse.model_validate(updated)


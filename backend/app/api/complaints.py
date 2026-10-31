from typing import Any
from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user
from app.schemas.common import CamelModel
from app.schemas.complaint import ComplaintDraft, ComplaintPatch, ComplaintResponse
from app.services.complaints import (
    create_complaint,
    get_complaint_by_id,
    list_complaints,
    update_complaint,
)

router = APIRouter(prefix="/complaints", tags=["complaints"])


class GroupRequest(CamelModel):
    primary_id: str
    secondary_id: str


@router.get(
    "",
    response_model=list[ComplaintResponse],
    summary="List complaints",
    description="Returns filtered list of complaints by student, status, priority, category, department, or keyword search.",
)
def get_complaints(
    student_id: str | None = Query(None, alias="studentId"),
    student_id_alt: str | None = Query(None, alias="student_id"),
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    department_id: str | None = Query(None, alias="departmentId"),
    department_id_alt: str | None = Query(None, alias="department_id"),
    query: str | None = None,
) -> list[ComplaintResponse]:
    items = list_complaints(
        student_id=student_id or student_id_alt,
        status=status,
        priority=priority,
        category=category,
        department_id=department_id or department_id_alt,
        query=query,
    )
    return [ComplaintResponse.model_validate(c) for c in items]


@router.post(
    "",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new complaint",
    description="Submits a complaint ticket for the authenticated student and initiates status tracking.",
)
def post_complaint(
    payload: ComplaintDraft,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ComplaintResponse:
    complaint = create_complaint(draft=payload, user=current_user)
    return ComplaintResponse.model_validate(complaint)


@router.get(
    "/{complaint_id}",
    response_model=ComplaintResponse,
    summary="Get complaint details",
    description="Retrieves a single complaint with its timeline updates by ticket ID or internal ID.",
)
def get_complaint(complaint_id: str) -> ComplaintResponse:
    complaint = get_complaint_by_id(complaint_id)
    return ComplaintResponse.model_validate(complaint)


@router.patch(
    "/{complaint_id}",
    response_model=ComplaintResponse,
    summary="Update complaint workflow",
    description="Updates status, priority, routing department, or duplicate grouping of a complaint.",
)
def patch_complaint(
    complaint_id: str,
    payload: ComplaintPatch,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ComplaintResponse:
    updated = update_complaint(
        complaint_id=complaint_id,
        patch=payload,
        actor=current_user["name"],
    )
    return ComplaintResponse.model_validate(updated)


@router.post(
    "/group",
    response_model=list[ComplaintResponse],
    summary="Group duplicate tickets",
    description="Links two complaints under a shared duplicate group identifier.",
)
def group_tickets(
    payload: GroupRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[ComplaintResponse]:
    c1 = get_complaint_by_id(payload.primary_id)
    group_id = c1.get("duplicate_group_id") or f"dup-{payload.primary_id[:6]}"

    u1 = update_complaint(
        complaint_id=payload.primary_id,
        patch=ComplaintPatch(duplicate_group_id=group_id, note="Linked to duplicate group."),
        actor=current_user["name"],
    )
    u2 = update_complaint(
        complaint_id=payload.secondary_id,
        patch=ComplaintPatch(duplicate_group_id=group_id, note="Linked to duplicate group."),
        actor=current_user["name"],
    )
    return [ComplaintResponse.model_validate(u1), ComplaintResponse.model_validate(u2)]


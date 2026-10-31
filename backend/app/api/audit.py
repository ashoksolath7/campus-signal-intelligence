from typing import Any
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, require_role
from app.schemas.audit import AuditLogResponse
from app.services.audit import list_audit_logs

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get(
    "",
    response_model=list[AuditLogResponse],
    summary="List operations audit logs",
    description="Returns chronological audit events for ticket, department, and user modifications (Admin only).",
)
def get_audit_logs(current_user: dict[str, Any] = Depends(get_current_user)) -> list[AuditLogResponse]:
    require_role("admin")(current_user)
    logs = list_audit_logs()
    return [AuditLogResponse.model_validate(log) for log in logs]


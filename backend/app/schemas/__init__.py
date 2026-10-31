from app.schemas.ai import (
    AIClassifyRequest,
    AIClassifyResponse,
    AIDuplicateDetectRequest,
    AIDuplicateDetectResponse,
    AISuggestedDuplicatesResponse,
    DuplicateMatch,
    SuggestedDuplicateGroup,
)
from app.schemas.analytics import (
    AnalyticsSummary,
    CategoryStat,
    DepartmentStat,
    PriorityStat,
    TrendStat,
)
from app.schemas.audit import AuditLogResponse
from app.schemas.common import CamelModel
from app.schemas.complaint import (
    Category,
    ComplaintDraft,
    ComplaintPatch,
    ComplaintResponse,
    ComplaintStatus,
    ComplaintUpdate,
    Priority,
)
from app.schemas.department import (
    DepartmentBase,
    DepartmentCreate,
    DepartmentPatch,
    DepartmentResponse,
)
from app.schemas.error import ErrorBody, ErrorResponse
from app.schemas.health import HealthResponse, MongoHealth
from app.schemas.user import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserBase,
    UserCreate,
    UserPatch,
    UserResponse,
    UserRole,
)

__all__ = [
    "AnalyticsSummary",
    "AuditLogResponse",
    "AuthResponse",
    "CamelModel",
    "Category",
    "CategoryStat",
    "ComplaintDraft",
    "ComplaintPatch",
    "ComplaintResponse",
    "ComplaintStatus",
    "ComplaintUpdate",
    "DepartmentBase",
    "DepartmentCreate",
    "DepartmentPatch",
    "DepartmentResponse",
    "DepartmentStat",
    "ErrorBody",
    "ErrorResponse",
    "HealthResponse",
    "LoginRequest",
    "MongoHealth",
    "Priority",
    "PriorityStat",
    "RegisterRequest",
    "TrendStat",
    "UserBase",
    "UserCreate",
    "UserPatch",
    "UserResponse",
    "UserRole",
]

from typing import Any
from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, require_role, require_roles
from app.core.errors import AppError
from app.schemas.user import UserCreate, UserPatch, UserResponse
from app.services.audit import record_audit_log
from app.services.users import create_user, get_user_by_id, list_users, update_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "",
    response_model=list[UserResponse],
    summary="List registered users (Admin only)",
    description="Returns all registered institutional users. Restricted to administrators.",
)
def get_users(current_user: dict[str, Any] = Depends(get_current_user)) -> list[UserResponse]:
    require_role("admin")(current_user)
    users = list_users()
    record_audit_log(
        actor=current_user.get("name", "Admin"),
        action="access_user_list",
        target="users",
        detail="Administrator accessed institutional user directory",
    )
    return [UserResponse.model_validate(u) for u in users]


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user profile by ID",
)
def get_user(user_id: str, current_user: dict[str, Any] = Depends(get_current_user)) -> UserResponse:
    if current_user.get("role") not in ("admin", "staff") and current_user.get("id") != user_id:
        raise AppError("You do not have permission to view other user profiles.", code="forbidden", status_code=403)
    user = get_user_by_id(user_id)
    record_audit_log(
        actor=current_user.get("name", "User"),
        action="access_user_identity",
        target=user_id,
        detail=f"User identity profile inspected by {current_user.get('role')}",
    )
    return UserResponse.model_validate(user)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (Admin only)",
)
def post_user(
    payload: UserCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> UserResponse:
    require_role("admin")(current_user)
    created = create_user(input_data=payload, actor=current_user["name"])
    return UserResponse.model_validate(created)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user account status or profile",
)
def patch_user(
    user_id: str,
    payload: UserPatch,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> UserResponse:
    # Users can update their own phone/name, but only admins can change role or active status
    if payload.role is not None or payload.active is not None:
        require_role("admin")(current_user)

    updated = update_user(user_id=user_id, patch=payload, actor=current_user["name"])
    return UserResponse.model_validate(updated)


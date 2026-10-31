from fastapi import Header

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.schemas.user import UserRole
from app.services.auth import find_user_by_id


async def get_current_user(authorization: str | None = Header(None)) -> dict:
    if not authorization:
        raise AppError("Missing authorization header", code="unauthorized", status_code=401)

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError("Invalid authorization format. Expected 'Bearer <token>'", code="unauthorized", status_code=401)

    token = parts[1]
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise AppError("Invalid token payload", code="unauthorized", status_code=401)

    user = find_user_by_id(user_id)
    if not user:
        raise AppError("User not found", code="user_not_found", status_code=404)

    if not user.get("active", True):
        raise AppError("User account is inactive", code="inactive_account", status_code=403)

    safe_user = dict(user)
    safe_user.pop("password", None)
    safe_user.pop("_id", None)
    return safe_user


def require_role(required_roles: UserRole | list[UserRole] | set[UserRole]):
    if isinstance(required_roles, str):
        allowed = {required_roles}
    else:
        allowed = set(required_roles)

    def role_checker(user: dict) -> dict:
        if not user or user.get("role") not in allowed:
            roles_str = ", ".join(sorted(allowed))
            raise AppError(
                f"Forbidden: requires one of [{roles_str}] privileges",
                code="forbidden",
                status_code=403,
            )
        return user

    return role_checker


def require_roles(*roles: UserRole):
    return require_role(list(roles))


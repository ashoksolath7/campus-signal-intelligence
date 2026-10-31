from datetime import datetime, timezone
from typing import Any
import uuid

from pymongo.errors import DuplicateKeyError

from app.core.errors import AppError
from app.core.persistence import handle_write_failure, is_demo_mode, require_durable_mongo
from app.core.security import get_password_hash
from app.database.mongodb import get_users_collection, ping_mongo
from app.database.seed import in_memory_db
from app.schemas.user import UserCreate, UserPatch
from app.services.audit import record_audit_log


def _is_mongo_connected() -> bool:
    try:
        health = ping_mongo()
        return health.get("status") == "connected"
    except Exception:
        return False


def _safe_user(user: dict[str, Any]) -> dict[str, Any]:
    safe = dict(user)
    safe.pop("password", None)
    safe.pop("_id", None)
    return safe


def list_users() -> list[dict[str, Any]]:
    if _is_mongo_connected():
        try:
            col = get_users_collection()
            users = list(col.find({}, {"password": 0, "_id": 0}))
            return users
        except Exception:
            pass

    return [_safe_user(u) for u in in_memory_db["users"]]


def get_user_by_id(user_id: str) -> dict[str, Any]:
    if _is_mongo_connected():
        try:
            col = get_users_collection()
            user = col.find_one({"id": user_id}, {"password": 0, "_id": 0})
            if user:
                return user
        except Exception:
            pass

    for u in in_memory_db["users"]:
        if u["id"] == user_id:
            return _safe_user(u)

    raise AppError(f"User '{user_id}' not found", code="user_not_found", status_code=404)


def create_user(input_data: UserCreate, actor: str) -> dict[str, Any]:
    norm_email = input_data.email.strip().lower()
    # Check if exists
    if _is_mongo_connected():
        try:
            col = get_users_collection()
            if col.find_one({"email": norm_email}):
                raise AppError(f"User with email '{norm_email}' already exists", code="user_exists", status_code=409)
        except AppError:
            raise
        except Exception:
            pass

    if any(u["email"].lower() == norm_email for u in in_memory_db["users"]):
        raise AppError(f"User with email '{norm_email}' already exists", code="user_exists", status_code=409)

    user_id = f"user-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    raw_user: dict[str, Any] = {
        "id": user_id,
        "name": input_data.name.strip(),
        "email": norm_email,
        "password": get_password_hash(input_data.password),
        "role": input_data.role,
        "student_id": input_data.student_id,
        "department_id": input_data.department_id,
        "phone": input_data.phone,
        "active": True,
        "created_at": now,
    }

    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_users_collection()
            col.insert_one(dict(raw_user))
        except DuplicateKeyError:
            raise AppError(f"User with email '{norm_email}' already exists", code="user_exists", status_code=409)
        except Exception as exc:
            handle_write_failure(exc, "create_user")
    else:
        in_memory_db["users"].append(raw_user)

    record_audit_log(
        actor=actor,
        action="create_user",
        target=norm_email,
        detail=f"Created user with role {input_data.role}",
    )
    return _safe_user(raw_user)


def update_user(user_id: str, patch: UserPatch, actor: str) -> dict[str, Any]:
    user = get_user_by_id(user_id)
    update_data = patch.model_dump(exclude_unset=True, by_alias=False)
    if not update_data:
        return user

    user.update(update_data)

    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_users_collection()
            res = col.update_one({"id": user_id}, {"$set": update_data})
            if res.matched_count == 0:
                raise AppError(f"User '{user_id}' not found", code="user_not_found", status_code=404)
        except AppError:
            raise
        except Exception as exc:
            handle_write_failure(exc, "update_user")
    else:
        for item in in_memory_db["users"]:
            if item["id"] == user_id:
                item.update(update_data)
                break

    record_audit_log(
        actor=actor,
        action="update_user",
        target=user_id,
        detail=f"Updated user fields: {list(update_data.keys())}",
    )
    return user


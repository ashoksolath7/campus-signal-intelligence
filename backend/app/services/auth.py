from datetime import datetime, timezone
import logging
from typing import Any
import uuid

from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.errors import AppError
from app.core.persistence import handle_write_failure, is_demo_mode, require_durable_mongo
from app.core.security import create_access_token, get_password_hash, verify_password
from app.database.mongodb import get_users_collection, ping_mongo
from app.database.seed import in_memory_db
from app.schemas.user import RegisterRequest, UserRole
from app.services.audit import record_audit_log
from app.services.email import validate_email_syntax
from app.services.otp import assert_email_verified, delete_otp_record

logger = logging.getLogger(__name__)


def _is_mongo_connected() -> bool:
    try:
        health = ping_mongo()
        return health.get("status") == "connected"
    except Exception:
        return False


def validate_college_email_domain(email: str) -> None:
    """Validates email address syntax across all providers without restriction."""
    validate_email_syntax(email)


def find_user_by_email(email: str) -> dict[str, Any] | None:
    norm_email = email.strip().lower()
    demo = is_demo_mode()

    if not demo:
        require_durable_mongo()
        try:
            col = get_users_collection()
            user = col.find_one({"email": norm_email})
            if user:
                user["id"] = user.get("id") or str(user.get("_id"))
                return user
            return None
        except AppError:
            raise
        except Exception as exc:
            handle_write_failure(exc, "find_user_by_email")
            return None

    for user in in_memory_db["users"]:
        if user["email"].lower() == norm_email:
            return dict(user)

    return None

def find_user_by_id(user_id: str) -> dict[str, Any] | None:
    demo = is_demo_mode()
    if not demo and _is_mongo_connected():
        try:
            col = get_users_collection()
            user = col.find_one({"id": user_id})
            if user:
                return user
            return None
        except Exception:
            pass

    # In demo mode fallback
    for user in in_memory_db["users"]:
        if user["id"] == user_id:
            return dict(user)
    return None


def find_user_by_student_id(student_id: str) -> dict[str, Any] | None:
    norm_sid = student_id.strip()
    demo = is_demo_mode()
    if not demo and _is_mongo_connected():
        try:
            col = get_users_collection()
            user = col.find_one({"student_id": norm_sid})
            if user:
                return user
            return None
        except Exception:
            pass

    # In demo mode fallback
    for user in in_memory_db["users"]:
        if user.get("student_id") == norm_sid:
            return dict(user)
    return None


def authenticate_user(email: str, password: str, role: UserRole) -> dict[str, Any]:
    norm_email = email.strip().lower()
    user = find_user_by_email(norm_email)
    if not user:
        raise AppError(
            "No matching account found for that email, password, and portal.",
            code="invalid_credentials",
            status_code=401,
        )

    if not verify_password(password, user.get("password", "")):
        raise AppError(
            "No matching account found for that email, password, and portal.",
            code="invalid_credentials",
            status_code=401,
        )

    user_role = user.get("role")
    # Verify role match or portal compatibility:
    # If portal is "admin", allow users with role "admin" or "staff"
    if role == "admin" and user_role in ("admin", "staff"):
        pass
    elif user_role != role:
        raise AppError(
            f"Account role does not match the requested {role} portal.",
            code="role_mismatch",
            status_code=403,
        )

    if not user.get("active", True):
        raise AppError("This account is inactive.", code="inactive_account", status_code=403)

    record_audit_log(
        actor=user.get("name", norm_email),
        action="login",
        target=norm_email,
        detail=f"Authenticated via {role} portal",
    )

    safe_user = dict(user)
    safe_user.pop("password", None)
    safe_user.pop("_id", None)
    return safe_user


def register_user(input_data: RegisterRequest) -> tuple[dict[str, Any], str]:
    # 1. Accept any syntactically valid email address (Gmail, Yahoo, Outlook, college, etc.)
    norm_email = validate_email_syntax(input_data.email)

    # 2. Check if account already exists
    if find_user_by_email(norm_email):
        raise AppError(
            f"An account with the email address '{norm_email}' already exists. Please sign in instead.",
            code="user_exists",
            status_code=409,
        )

    # 3. Require successful OTP verification prior to account creation
    assert_email_verified(norm_email, verification_token=input_data.verification_token, otp=input_data.otp)

    role = input_data.role or "student"
    student_id = input_data.student_id.strip() if input_data.student_id else None
    if role == "student":
        if not student_id:
            raise AppError("studentId is required for student registration", code="missing_field", status_code=422)
        if find_user_by_student_id(student_id):
            raise AppError(
                f"A student with ID '{student_id}' is already registered.",
                code="student_id_exists",
                status_code=409,
            )

    now = datetime.now(timezone.utc).isoformat()
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    hashed_pwd = get_password_hash(input_data.password)

    new_user: dict[str, Any] = {
        "id": user_id,
        "name": input_data.name.strip(),
        "email": norm_email,
        "password": hashed_pwd,
        "role": role,
        "student_id": student_id,
        "faculty_id": input_data.faculty_id.strip() if input_data.faculty_id else None,
        "staff_id": input_data.staff_id.strip() if input_data.staff_id else None,
        "department_id": input_data.department_id,
        "phone": input_data.phone,
        "active": True,
        "email_verified": True,
        "verification_status": "otp_verified",
        "created_at": now,
        "updated_at": now,
    }

    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_users_collection()
            col.insert_one(dict(new_user))
        except DuplicateKeyError as exc:
            err_msg = str(exc)
            if "student_id" in err_msg:
                raise AppError(f"A student with ID '{student_id}' is already registered.", code="student_id_exists", status_code=409)
            raise AppError("An account with that email already exists.", code="user_exists", status_code=409)
        except Exception as exc:
            handle_write_failure(exc, "register_user")
    else:
        in_memory_db["users"].append(new_user)

    # 4. Clean up consumed OTP record after successful account creation
    delete_otp_record(norm_email)

    record_audit_log(
        actor=new_user["name"],
        action="register_user",
        target=norm_email,
        detail=f"Registered account with role '{role}' via verified email OTP",
    )

    token = create_access_token({"sub": user_id, "role": role, "email": norm_email})

    safe_user = dict(new_user)
    safe_user.pop("password", None)
    safe_user.pop("_id", None)
    return safe_user, token


def register_student(input_data: RegisterRequest) -> tuple[dict[str, Any], str]:
    """Compatibility alias for student registration."""
    return register_user(input_data)


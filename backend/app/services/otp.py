from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import secrets
from typing import Any

from app.core.config import settings
from app.core.errors import AppError
from app.core.persistence import handle_write_failure, is_demo_mode, require_durable_mongo
from app.core.security import create_access_token, decode_access_token
from app.database.mongodb import get_database, ping_mongo
from app.database.seed import in_memory_db
from app.services.audit import record_audit_log
from app.services.email import send_otp_email, validate_email_syntax

logger = logging.getLogger(__name__)

# Ensure email_otps dictionary exists in in-memory database
if "email_otps" not in in_memory_db:
    in_memory_db["email_otps"] = {}


def _is_mongo_connected() -> bool:
    try:
        return ping_mongo().get("status") == "connected"
    except Exception:
        return False


def _get_otps_collection():
    return get_database()["email_otps"]


def generate_secure_otp() -> str:
    """Generates a cryptographically secure random 6-digit one-time passcode."""
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(email: str, otp: str) -> str:
    """Computes a salted cryptographic hash of the OTP for secure storage."""
    payload = f"{email.strip().lower()}:{otp.strip()}:{settings.jwt_secret_key}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def get_otp_record(email: str) -> dict[str, Any] | None:
    norm_email = email.strip().lower()
    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = _get_otps_collection()
            rec = col.find_one({"email": norm_email})
            if rec:
                rec_dict = dict(rec)
                rec_dict.pop("_id", None)
                return rec_dict
            return None
        except AppError:
            raise
        except Exception as exc:
            handle_write_failure(exc, "get_otp_record")

    # In explicit demo mode
    return in_memory_db["email_otps"].get(norm_email)


def save_otp_record(record: dict[str, Any]) -> None:
    norm_email = record["email"].strip().lower()
    clean_rec = dict(record)
    clean_rec["email"] = norm_email

    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = _get_otps_collection()
            col.replace_one({"email": norm_email}, clean_rec, upsert=True)
            return
        except AppError:
            raise
        except Exception as exc:
            handle_write_failure(exc, "save_otp_record")

    # In explicit demo mode
    in_memory_db["email_otps"][norm_email] = clean_rec


def delete_otp_record(email: str) -> None:
    norm_email = email.strip().lower()
    demo = is_demo_mode()
    if not demo:
        if _is_mongo_connected():
            try:
                col = _get_otps_collection()
                col.delete_one({"email": norm_email})
            except Exception:
                pass
    else:
        in_memory_db["email_otps"].pop(norm_email, None)


def request_registration_otp(email: str) -> dict[str, Any]:
    """Generates and sends a 6-digit OTP to any syntactically valid email address."""
    norm_email = validate_email_syntax(email)

    # 1. Prevent duplicate registration if account already exists
    from app.services.auth import find_user_by_email
    if find_user_by_email(norm_email):
        raise AppError(
            f"An account with the email address '{norm_email}' already exists. Please sign in instead.",
            code="user_exists",
            status_code=409,
        )

    now = datetime.now(timezone.utc)

    # 2. Check 60-second cooldown
    existing = get_otp_record(norm_email)
    if existing and "resend_available_at" in existing:
        try:
            resend_dt = datetime.fromisoformat(existing["resend_available_at"])
            if now < resend_dt:
                remaining_secs = int((resend_dt - now).total_seconds()) + 1
                raise AppError(
                    f"Please wait {remaining_secs} seconds before requesting a new verification code.",
                    code="otp_cooldown",
                    status_code=429,
                )
        except AppError:
            raise
        except Exception:
            pass

    # 3. Generate 6-digit OTP
    otp = generate_secure_otp()
    hashed = hash_otp(norm_email, otp)
    expires_at = now + timedelta(minutes=settings.otp_expire_minutes)
    resend_available_at = now + timedelta(seconds=settings.otp_resend_cooldown_seconds)

    record: dict[str, Any] = {
        "email": norm_email,
        "hashed_otp": hashed,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "resend_available_at": resend_available_at.isoformat(),
        "attempts": 0,
        "max_attempts": settings.otp_max_attempts,
        "verified": False,
        "verified_at": None,
    }

    # 4. Deliver real email via SMTP first before persisting record.
    # If email delivery fails, no unusable record is created and no false cooldown is imposed.
    try:
        delivery = send_otp_email(to_email=norm_email, otp=otp)
    except Exception:
        delete_otp_record(norm_email)
        raise

    # 5. Persist record only after SMTP server accepts the email
    save_otp_record(record)

    record_audit_log(
        actor=norm_email,
        action="send_otp",
        target=norm_email,
        detail=f"Generated and dispatched verification OTP (expires in {settings.otp_expire_minutes}m)",
    )

    return {
        "message": f"Verification code sent successfully to {norm_email}.",
        "email": norm_email,
        "cooldown_seconds": settings.otp_resend_cooldown_seconds,
        "expires_in_seconds": settings.otp_expire_minutes * 60,
        "delivery": delivery,
    }


def verify_registration_otp(email: str, otp: str) -> dict[str, Any]:
    """Validates the 6-digit OTP against the stored hash and enforces expiration and rate limits."""
    norm_email = validate_email_syntax(email)
    clean_otp = str(otp).strip()

    if not clean_otp or len(clean_otp) != 6 or not clean_otp.isdigit():
        raise AppError("Please provide a valid 6-digit numeric verification code.", code="invalid_otp_format", status_code=400)

    record = get_otp_record(norm_email)
    if not record:
        raise AppError(
            "No verification code found for this email. Please click 'Send OTP' first.",
            code="otp_not_found",
            status_code=404,
        )

    now = datetime.now(timezone.utc)

    # 1. Check expiration (5 minutes)
    try:
        exp_dt = datetime.fromisoformat(record["expires_at"])
        if now > exp_dt:
            delete_otp_record(norm_email)
            raise AppError(
                "Verification code has expired. Please request a new code.",
                code="otp_expired",
                status_code=400,
            )
    except AppError:
        raise
    except Exception:
        delete_otp_record(norm_email)
        raise AppError("Verification code invalid. Please request a new code.", code="otp_invalid", status_code=400)

    # 2. Check maximum incorrect attempts (5 attempts)
    attempts = int(record.get("attempts", 0))
    if attempts >= settings.otp_max_attempts:
        delete_otp_record(norm_email)
        raise AppError(
            "Maximum verification attempts exceeded. Please request a new verification code.",
            code="max_attempts_exceeded",
            status_code=429,
        )

    # 3. Compare hash in constant time
    target_hash = hash_otp(norm_email, clean_otp)
    stored_hash = record.get("hashed_otp", "")

    if not hmac.compare_digest(target_hash, stored_hash):
        record["attempts"] = attempts + 1
        save_otp_record(record)
        remaining = settings.otp_max_attempts - record["attempts"]
        if remaining <= 0:
            delete_otp_record(norm_email)
            raise AppError(
                "Incorrect verification code. Maximum attempts exceeded. Please request a new code.",
                code="max_attempts_exceeded",
                status_code=429,
            )
        raise AppError(
            f"Incorrect verification code. {remaining} attempt(s) remaining.",
            code="invalid_otp",
            status_code=400,
        )

    # 4. Successful verification: mark verified and generate verification token
    record["verified"] = True
    record["verified_at"] = now.isoformat()
    save_otp_record(record)

    # Issue signed verification token valid for 15 minutes
    verification_token = create_access_token(
        data={"sub": norm_email, "type": "otp_verified", "purpose": "registration"},
        expires_delta=timedelta(minutes=15),
    )

    record_audit_log(
        actor=norm_email,
        action="verify_otp",
        target=norm_email,
        detail="OTP verified successfully; registration authorized",
    )

    return {
        "message": "Email verified successfully.",
        "email": norm_email,
        "verified": True,
        "verification_token": verification_token,
    }


def assert_email_verified(email: str, verification_token: str | None = None, otp: str | None = None) -> None:
    """Ensures that the email has been verified via OTP before account creation."""
    norm_email = email.strip().lower()

    # Case A: User provides verification_token
    if verification_token:
        try:
            payload = decode_access_token(verification_token)
            if payload.get("sub") == norm_email and payload.get("type") == "otp_verified":
                return
        except Exception:
            pass

    # Case B: User provides OTP directly with registration form
    if otp:
        verify_registration_otp(norm_email, otp)
        return

    # Case C: Check verified status in DB within 15 minutes
    rec = get_otp_record(norm_email)
    if rec and rec.get("verified") is True and rec.get("verified_at"):
        try:
            ver_dt = datetime.fromisoformat(rec["verified_at"])
            now = datetime.now(timezone.utc)
            if (now - ver_dt).total_seconds() < 900:  # 15 minutes
                return
        except Exception:
            pass

    raise AppError(
        f"Email verification required for {norm_email}. Please request and verify your 6-digit OTP code before completing registration.",
        code="email_not_verified",
        status_code=403,
    )


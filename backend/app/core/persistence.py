from contextvars import ContextVar
import logging
from typing import Any

from app.core.config import settings
from app.core.errors import AppError
from app.database.mongodb import invalidate_ping_cache, ping_mongo

logger = logging.getLogger(__name__)

# Context variable set per HTTP request based on explicit X-Demo-Mode header or query param
demo_mode_ctx: ContextVar[bool] = ContextVar("demo_mode_ctx", default=False)


def is_demo_mode() -> bool:
    """
    Determines whether the current operation is in explicitly labelled demo fallback mode.
    STRICT RULE: In production (app_env == "production"), demo mode is FORBIDDEN.
    In development/test, demo mode is active ONLY if explicitly requested via X-Demo-Mode header
    or if MongoDB is not configured at all.
    """
    if settings.app_env == "production":
        return False

    # Check explicit request header/context
    if demo_mode_ctx.get():
        return True

    # If MongoDB is not configured in .env at all
    if not settings.mongodb_configured:
        return True

    return False


def require_durable_mongo() -> None:
    """
    Asserts that MongoDB Atlas is connected and available for durable persistence.
    If unavailable and demo mode is not active, raises HTTP 503.
    """
    if is_demo_mode():
        return

    health = ping_mongo()
    if health.get("status") != "connected":
        raise AppError(
            "Database service is unavailable. The operation could not be durably saved in MongoDB Atlas.",
            code="database_unavailable",
            status_code=503,
        )


def handle_write_failure(exc: Exception, operation_name: str) -> None:
    """
    Handles a MongoDB write failure. Invalidates the ping cache and raises an AppError.
    Never allows critical writes to silently fall back to in-memory store in production or non-demo requests.
    """
    logger.error("MongoDB write failure during '%s': %s", operation_name, exc)
    invalidate_ping_cache(disconnected=True)
    if is_demo_mode():
        return

    raise AppError(
        f"Database write failure during {operation_name}. The record could not be durably saved in MongoDB Atlas.",
        code="database_write_failed",
        status_code=503,
    )


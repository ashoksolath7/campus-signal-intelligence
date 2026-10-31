from datetime import datetime, timezone
import logging
from typing import Any
import uuid

from app.core.persistence import is_demo_mode
from app.database.mongodb import get_audit_logs_collection, ping_mongo
from app.database.seed import in_memory_db

logger = logging.getLogger(__name__)


def _is_mongo_connected() -> bool:
    try:
        health = ping_mongo()
        return health.get("status") == "connected"
    except Exception:
        return False


def record_audit_log(actor: str, action: str, target: str, detail: str) -> dict[str, Any]:
    log_id = f"aud-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    entry: dict[str, Any] = {
        "id": log_id,
        "at": now,
        "actor": actor,
        "action": action,
        "target": target,
        "detail": detail,
    }

    demo = is_demo_mode()
    if not demo and _is_mongo_connected():
        try:
            col = get_audit_logs_collection()
            col.insert_one(dict(entry))
            return entry
        except Exception as exc:
            logger.error("Audit log persistence to MongoDB failed: %s", exc)

    if demo:
        in_memory_db["audit_logs"].insert(0, entry)

    return entry


def list_audit_logs() -> list[dict[str, Any]]:
    demo = is_demo_mode()
    if not demo and _is_mongo_connected():
        try:
            col = get_audit_logs_collection()
            logs = list(col.find({}, {"_id": 0}).sort("at", -1))
            return logs
        except Exception:
            pass

    return sorted(in_memory_db["audit_logs"], key=lambda x: x.get("at", ""), reverse=True)


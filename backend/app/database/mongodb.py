import logging
import threading
import time
from typing import Any

import certifi
from pymongo import MongoClient, ReturnDocument
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

_client: MongoClient | None = None
_ping_lock = threading.Lock()
_last_ping_time: float = 0.0
_last_ping_result: dict[str, Any] | None = None

_in_memory_counter_lock = threading.Lock()
_in_memory_seq: int | None = None


def invalidate_ping_cache(disconnected: bool = False) -> None:
    """Invalidates the health-check ping cache immediately. If disconnected=True, sets status to disconnected."""
    global _last_ping_time, _last_ping_result
    with _ping_lock:
        if disconnected:
            _last_ping_time = time.time()
            _last_ping_result = {
                "status": "disconnected",
                "configured": bool(settings.mongodb_configured),
                "database": settings.mongodb_db_name,
            }
        else:
            _last_ping_time = 0.0
            _last_ping_result = None


def get_client() -> MongoClient | None:
    global _client
    if not settings.mongodb_configured:
        return None
    if _client is None:
        _client = MongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=8000,
            uuidRepresentation="standard",
            tlsCAFile=certifi.where(),
        )
    return _client


def get_database() -> Database:
    client = get_client()
    if client is None:
        raise AppError(
            "MongoDB is not configured",
            code="database_not_configured",
            status_code=503,
        )
    return client[settings.mongodb_db_name]


def get_users_collection():
    return get_database()["users"]


def get_departments_collection():
    return get_database()["departments"]


def get_complaints_collection():
    return get_database()["complaints"]


def get_audit_logs_collection():
    return get_database()["audit_logs"]


def get_counters_collection():
    return get_database()["counters"]


def get_next_ticket_number(is_demo: bool = False) -> str:
    """
    Atomically allocates the next sequential ticket identifier (e.g. CSI-2405).
    In persistent mode: uses atomic MongoDB find_one_and_update with $inc on counters collection.
    In demo mode: uses thread-safe synchronized in-memory sequence.
    Guarantees strictly sequential, collision-free ticket IDs across concurrent requests.
    """
    from app.database.seed import in_memory_db

    if not is_demo and settings.mongodb_configured:
        try:
            col = get_counters_collection()
            # Ensure counter document exists with proper starting base if uninitialized
            doc = col.find_one({"_id": "ticket_counter"})
            if doc is None:
                complaints_col = get_complaints_collection()
                latest = list(
                    complaints_col.find({"ticket": {"$regex": r"^CSI-\d+$"}})
                    .sort("ticket", -1)
                    .limit(1)
                )
                base = 2400
                if latest and "ticket" in latest[0]:
                    try:
                        base = int(latest[0]["ticket"].replace("CSI-", ""))
                    except ValueError:
                        pass
                col.update_one(
                    {"_id": "ticket_counter"},
                    {"$setOnInsert": {"seq": base}},
                    upsert=True,
                )

            res = col.find_one_and_update(
                {"_id": "ticket_counter"},
                {"$inc": {"seq": 1}},
                return_document=ReturnDocument.AFTER,
                upsert=True,
            )
            seq = res["seq"]
            return f"CSI-{seq}"
        except Exception as exc:
            logger.warning("MongoDB atomic ticket counter failed: %s", exc)
            if settings.app_env == "production" or not is_demo:
                invalidate_ping_cache(disconnected=True)
                raise AppError(
                    "Database counter service unavailable for ticket generation.",
                    code="database_unavailable",
                    status_code=503,
                )

    # Thread-safe in-memory sequence for demo mode
    global _in_memory_seq
    with _in_memory_counter_lock:
        if _in_memory_seq is None:
            max_num = 2400
            for c in in_memory_db.get("complaints", []):
                t = c.get("ticket", "")
                if t.startswith("CSI-"):
                    try:
                        n = int(t.replace("CSI-", ""))
                        if n > max_num:
                            max_num = n
                    except ValueError:
                        pass
            _in_memory_seq = max_num
        _in_memory_seq += 1
        return f"CSI-{_in_memory_seq}"


def ping_mongo(force: bool = False) -> dict[str, Any]:
    global _last_ping_time, _last_ping_result
    now = time.time()
    if not force:
        with _ping_lock:
            if _last_ping_result is not None and (now - _last_ping_time) < 15.0:
                return dict(_last_ping_result)

    database = settings.mongodb_db_name
    if not settings.mongodb_configured:
        res = {"status": "not_configured", "configured": False, "database": database}
        with _ping_lock:
            _last_ping_time = now
            _last_ping_result = res
        return dict(res)
    try:
        client = get_client()
        if client is None:
            res = {"status": "not_configured", "configured": False, "database": database}
            with _ping_lock:
                _last_ping_time = now
                _last_ping_result = res
            return dict(res)
        client[database].command("ping")
        res = {"status": "connected", "configured": True, "database": database}
        with _ping_lock:
            _last_ping_time = now
            _last_ping_result = res
        return dict(res)
    except PyMongoError as exc:
        logger.warning("MongoDB ping failed (%s)", type(exc).__name__)
        res = {"status": "disconnected", "configured": True, "database": database}
        with _ping_lock:
            _last_ping_time = now
            _last_ping_result = res
        return dict(res)


def init_db_indexes(database: Database | None = None) -> dict[str, list[str]]:
    """Initialize essential MongoDB indexes for core entities with duplicate protection."""
    if database is None:
        if not settings.mongodb_configured:
            return {}
        try:
            database = get_database()
        except Exception:
            return {}

    created: dict[str, list[str]] = {}
    try:
        users = database["users"]
        users.create_index("email", unique=True, name="idx_users_email_unique")
        users.create_index("id", unique=True, name="idx_users_id_unique")
        users.create_index(
            [("student_id", 1)],
            unique=True,
            sparse=True,
            name="idx_users_student_id_unique_sparse",
        )
        users.create_index("role", name="idx_users_role")
        created["users"] = [idx["name"] for idx in users.list_indexes()]

        complaints = database["complaints"]
        complaints.create_index("ticket", unique=True, name="idx_complaints_ticket_unique")
        complaints.create_index("id", unique=True, name="idx_complaints_id_unique")
        complaints.create_index("student_id", name="idx_complaints_student_id")
        complaints.create_index("status", name="idx_complaints_status")
        complaints.create_index("department_id", name="idx_complaints_department_id")
        complaints.create_index("duplicate_group_id", sparse=True, name="idx_complaints_duplicate_group_id")
        complaints.create_index([("created_at", -1)], name="idx_complaints_created_at_desc")
        created["complaints"] = [idx["name"] for idx in complaints.list_indexes()]

        departments = database["departments"]
        departments.create_index("code", unique=True, name="idx_departments_code_unique")
        departments.create_index("id", unique=True, name="idx_departments_id_unique")
        departments.create_index("active", name="idx_departments_active")
        created["departments"] = [idx["name"] for idx in departments.list_indexes()]

        audit_logs = database["audit_logs"]
        audit_logs.create_index("id", unique=True, name="idx_audit_logs_id_unique")
        audit_logs.create_index([("at", -1)], name="idx_audit_logs_at_desc")
        audit_logs.create_index("action", name="idx_audit_logs_action")
        audit_logs.create_index("actor", name="idx_audit_logs_actor")
        created["audit_logs"] = [idx["name"] for idx in audit_logs.list_indexes()]

        logger.info("MongoDB indexes verified/created successfully.")
    except Exception as exc:
        logger.warning("Failed to initialize MongoDB indexes: %s", exc)
    return created


def close_mongo() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None

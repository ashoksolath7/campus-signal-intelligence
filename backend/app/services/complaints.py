from datetime import datetime, timezone
import random
from typing import Any
import uuid

from pymongo.errors import DuplicateKeyError

from app.core.errors import AppError
from app.core.persistence import handle_write_failure, is_demo_mode, require_durable_mongo
from app.database.mongodb import (
    get_complaints_collection,
    get_next_ticket_number,
    ping_mongo,
)
from app.database.seed import in_memory_db
from app.schemas.complaint import ComplaintDraft, ComplaintPatch
from app.services.audit import record_audit_log


def _is_mongo_connected() -> bool:
    try:
        health = ping_mongo()
        return health.get("status") == "connected"
    except Exception:
        return False


def list_complaints(
    student_id: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    department_id: str | None = None,
    query: str | None = None,
) -> list[dict[str, Any]]:
    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_complaints_collection()
            mongo_query: dict[str, Any] = {}
            if student_id:
                mongo_query["student_id"] = student_id
            if status and status != "all":
                mongo_query["status"] = status
            if priority and priority != "all":
                mongo_query["priority"] = priority
            if category and category != "all":
                mongo_query["category"] = category
            if department_id and department_id != "all":
                mongo_query["department_id"] = department_id
            if query and query.strip():
                regex = {"$regex": query.strip(), "$options": "i"}
                mongo_query["$or"] = [
                    {"ticket": regex},
                    {"title": regex},
                    {"description": regex},
                    {"location": regex},
                ]

            return list(col.find(mongo_query, {"_id": 0}).sort("created_at", -1))
        except Exception as exc:
            handle_write_failure(exc, "list_complaints")

    # Explicit Demo Mode Fallback
    res = list(in_memory_db["complaints"])
    if student_id:
        res = [c for c in res if c.get("student_id") == student_id]
    if status and status != "all":
        res = [c for c in res if c.get("status") == status]
    if priority and priority != "all":
        res = [c for c in res if c.get("priority") == priority]
    if category and category != "all":
        res = [c for c in res if c.get("category") == category]
    if department_id and department_id != "all":
        res = [c for c in res if c.get("department_id") == department_id]
    if query and query.strip():
        q = query.strip().lower()
        res = [
            c
            for c in res
            if q in c.get("ticket", "").lower()
            or q in c.get("title", "").lower()
            or q in c.get("description", "").lower()
            or q in c.get("location", "").lower()
        ]

    return sorted(res, key=lambda x: x.get("created_at", ""), reverse=True)


def get_complaint_by_id(complaint_id: str) -> dict[str, Any]:
    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_complaints_collection()
            doc = col.find_one({"id": complaint_id}, {"_id": 0})
            if doc:
                return doc
            raise AppError(f"Complaint '{complaint_id}' not found", code="complaint_not_found", status_code=404)
        except AppError:
            raise
        except Exception as exc:
            handle_write_failure(exc, "get_complaint_by_id")

    # Explicit Demo Mode Fallback
    for c in in_memory_db["complaints"]:
        if c["id"] == complaint_id:
            return dict(c)

    raise AppError(f"Complaint '{complaint_id}' not found", code="complaint_not_found", status_code=404)


def create_complaint(draft: ComplaintDraft, user: dict[str, Any]) -> dict[str, Any]:
    demo = is_demo_mode()
    now = datetime.now(timezone.utc).isoformat()
    cid = f"cmp-{uuid.uuid4().hex[:8]}"
    ticket = get_next_ticket_number(is_demo=demo)

    complaint: dict[str, Any] = {
        "id": cid,
        "ticket": ticket,
        "title": draft.title.strip(),
        "description": draft.description.strip(),
        "category": draft.category,
        "department_id": draft.department_id,
        "student_id": user["id"],
        "student_name": user["name"],
        "student_email": user["email"],
        "status": "submitted",
        "priority": "medium",
        "location": draft.location.strip(),
        "image_url": draft.image_url,
        "created_at": now,
        "updated_at": now,
        "duplicate_group_id": None,
        "updates": [
            {
                "at": now,
                "status": "submitted",
                "note": "Complaint submitted by student.",
                "actor": user["name"],
            }
        ],
    }

    if not demo:
        require_durable_mongo()
        try:
            col = get_complaints_collection()
            col.insert_one(dict(complaint))
        except Exception as exc:
            handle_write_failure(exc, "create_complaint")
    else:
        in_memory_db["complaints"].insert(0, complaint)

    record_audit_log(
        actor=user["name"],
        action="create_complaint",
        target=ticket,
        detail=complaint["title"],
    )
    return complaint


def update_complaint(complaint_id: str, patch: ComplaintPatch, actor: str) -> dict[str, Any]:
    complaint = get_complaint_by_id(complaint_id)
    now = datetime.now(timezone.utc).isoformat()

    updates_list = list(complaint.get("updates", []))
    if patch.status and patch.status != complaint.get("status"):
        updates_list.append({
            "at": now,
            "status": patch.status,
            "note": patch.note or f"Status changed to {patch.status.replace('_', ' ')}.",
            "actor": actor,
        })

    patch_dict = patch.model_dump(exclude_unset=True, by_alias=False)
    patch_dict.pop("note", None)  # internal update note goes to updates list
    patch_dict["updated_at"] = now
    patch_dict["updates"] = updates_list

    complaint.update(patch_dict)

    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_complaints_collection()
            res = col.update_one({"id": complaint_id}, {"$set": patch_dict})
            if res.matched_count == 0:
                raise AppError(f"Complaint '{complaint_id}' not found", code="complaint_not_found", status_code=404)
        except AppError:
            raise
        except Exception as exc:
            handle_write_failure(exc, "update_complaint")
    else:
        matched = False
        for item in in_memory_db["complaints"]:
            if item["id"] == complaint_id:
                item.update(patch_dict)
                matched = True
                break
        if not matched:
            raise AppError(f"Complaint '{complaint_id}' not found", code="complaint_not_found", status_code=404)

    record_audit_log(
        actor=actor,
        action="update_complaint",
        target=complaint.get("ticket", complaint_id),
        detail=patch.note or f"Updated complaint {complaint_id}",
    )
    return complaint


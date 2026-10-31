from typing import Any
import uuid

from pymongo.errors import DuplicateKeyError

from app.core.errors import AppError
from app.core.persistence import handle_write_failure, is_demo_mode, require_durable_mongo
from app.database.mongodb import get_departments_collection, ping_mongo
from app.database.seed import in_memory_db
from app.schemas.department import DepartmentCreate, DepartmentPatch
from app.services.audit import record_audit_log


def _is_mongo_connected() -> bool:
    try:
        health = ping_mongo()
        return health.get("status") == "connected"
    except Exception:
        return False


def list_departments(active_only: bool = False) -> list[dict[str, Any]]:
    if _is_mongo_connected():
        try:
            col = get_departments_collection()
            query = {"active": True} if active_only else {}
            return list(col.find(query, {"_id": 0}))
        except Exception:
            pass

    items = in_memory_db["departments"]
    if active_only:
        return [dict(d) for d in items if d.get("active", True)]
    return [dict(d) for d in items]


def get_department_by_id(department_id: str) -> dict[str, Any]:
    if _is_mongo_connected():
        try:
            col = get_departments_collection()
            dept = col.find_one({"id": department_id}, {"_id": 0})
            if dept:
                return dept
        except Exception:
            pass

    for dept in in_memory_db["departments"]:
        if dept["id"] == department_id:
            return dict(dept)

    raise AppError(f"Department '{department_id}' not found", code="department_not_found", status_code=404)


def create_department(data: DepartmentCreate, actor: str) -> dict[str, Any]:
    dept_id = f"dept-{data.code.lower()}"
    new_dept: dict[str, Any] = {
        "id": dept_id,
        "name": data.name.strip(),
        "code": data.code.strip().upper(),
        "head": data.head.strip(),
        "email": data.email.strip().lower(),
        "active": data.active,
    }

    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_departments_collection()
            if col.find_one({"code": new_dept["code"]}):
                raise AppError(f"Department code '{new_dept['code']}' already exists", code="department_exists", status_code=409)
            col.insert_one(dict(new_dept))
        except AppError:
            raise
        except DuplicateKeyError:
            raise AppError(f"Department code '{new_dept['code']}' already exists", code="department_exists", status_code=409)
        except Exception as exc:
            handle_write_failure(exc, "create_department")
    else:
        if any(d["code"] == new_dept["code"] for d in in_memory_db["departments"]):
            raise AppError(f"Department code '{new_dept['code']}' already exists", code="department_exists", status_code=409)
        in_memory_db["departments"].append(new_dept)

    record_audit_log(
        actor=actor,
        action="create_department",
        target=new_dept["name"],
        detail=f"Created department {new_dept['name']} ({new_dept['code']})",
    )
    return new_dept


def update_department(department_id: str, patch: DepartmentPatch, actor: str) -> dict[str, Any]:
    dept = get_department_by_id(department_id)
    update_data = patch.model_dump(exclude_unset=True, by_alias=False)
    if not update_data:
        return dept

    dept.update(update_data)

    demo = is_demo_mode()
    if not demo:
        require_durable_mongo()
        try:
            col = get_departments_collection()
            col.update_one({"id": department_id}, {"$set": update_data})
        except Exception as exc:
            handle_write_failure(exc, "update_department")
    else:
        for item in in_memory_db["departments"]:
            if item["id"] == department_id:
                item.update(update_data)
                break

    record_audit_log(
        actor=actor,
        action="update_department",
        target=department_id,
        detail=f"Updated department fields: {list(update_data.keys())}",
    )
    return dept


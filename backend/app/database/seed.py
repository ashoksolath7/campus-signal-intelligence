import argparse
import logging
from typing import Any
from app.core.config import settings
from app.core.security import get_password_hash
from app.database.mongodb import (
    get_audit_logs_collection,
    get_complaints_collection,
    get_database,
    get_departments_collection,
    get_users_collection,
    init_db_indexes,
    ping_mongo,
)

logger = logging.getLogger(__name__)

INITIAL_DEPARTMENTS = [
    {
        "id": "dept-facilities",
        "name": "Facilities",
        "code": "FAC",
        "head": "Anita Rao",
        "email": "facilities@campus.edu",
        "active": True,
        "created_at": "2026-08-01T09:00:00.000Z",
        "updated_at": "2026-08-01T09:00:00.000Z",
    },
    {
        "id": "dept-academic",
        "name": "Academic Affairs",
        "code": "ACA",
        "head": "Rahul Mehta",
        "email": "academics@campus.edu",
        "active": True,
        "created_at": "2026-08-01T09:00:00.000Z",
        "updated_at": "2026-08-01T09:00:00.000Z",
    },
    {
        "id": "dept-hostel",
        "name": "Hostel Office",
        "code": "HST",
        "head": "Priya Nair",
        "email": "hostel@campus.edu",
        "active": True,
        "created_at": "2026-08-01T09:00:00.000Z",
        "updated_at": "2026-08-01T09:00:00.000Z",
    },
    {
        "id": "dept-it",
        "name": "IT Services",
        "code": "ITS",
        "head": "Vikram Shah",
        "email": "itsupport@campus.edu",
        "active": True,
        "created_at": "2026-08-01T09:00:00.000Z",
        "updated_at": "2026-08-01T09:00:00.000Z",
    },
    {
        "id": "dept-security",
        "name": "Campus Security",
        "code": "SEC",
        "head": "Imran Khan",
        "email": "security@campus.edu",
        "active": True,
        "created_at": "2026-08-01T09:00:00.000Z",
        "updated_at": "2026-08-01T09:00:00.000Z",
    },
    {
        "id": "dept-transport",
        "name": "Transport",
        "code": "TRN",
        "head": "Sneha Iyer",
        "email": "transport@campus.edu",
        "active": True,
        "created_at": "2026-08-01T09:00:00.000Z",
        "updated_at": "2026-08-01T09:00:00.000Z",
    },
]

INITIAL_USERS = [
    {
        "id": "user-admin",
        "name": "Campus Admin",
        "email": "admin@campus.edu",
        "password": get_password_hash("campus123"),
        "role": "admin",
        "department_id": "dept-academic",
        "phone": "080-1000-0001",
        "active": True,
        "email_verified": True,
        "verification_status": "prototype_verified",
        "created_at": "2026-08-01T09:00:00.000Z",
        "updated_at": "2026-08-01T09:00:00.000Z",
    },
    {
        "id": "user-ops",
        "name": "Meera Joshi",
        "email": "meera.joshi@campus.edu",
        "password": get_password_hash("campus123"),
        "role": "admin",
        "department_id": "dept-facilities",
        "phone": "080-1000-0002",
        "active": True,
        "email_verified": True,
        "verification_status": "prototype_verified",
        "created_at": "2026-08-18T09:30:00.000Z",
        "updated_at": "2026-08-18T09:30:00.000Z",
    },
    {
        "id": "user-faculty",
        "name": "Dr. Vikram Rao",
        "email": "faculty@campus.edu",
        "password": get_password_hash("campus123"),
        "role": "faculty",
        "faculty_id": "FAC-1020",
        "department_id": "dept-academic",
        "phone": "9876500010",
        "active": True,
        "email_verified": True,
        "verification_status": "prototype_verified",
        "created_at": "2026-08-10T10:00:00.000Z",
        "updated_at": "2026-08-10T10:00:00.000Z",
    },
    {
        "id": "user-staff",
        "name": "Rajesh Kumar",
        "email": "staff@campus.edu",
        "password": get_password_hash("campus123"),
        "role": "staff",
        "staff_id": "STF-3010",
        "department_id": "dept-facilities",
        "phone": "9876500011",
        "active": True,
        "email_verified": True,
        "verification_status": "prototype_verified",
        "created_at": "2026-08-12T11:00:00.000Z",
        "updated_at": "2026-08-12T11:00:00.000Z",
    },
    {
        "id": "user-student",
        "name": "Aisha Rahman",
        "email": "student@campus.edu",
        "password": get_password_hash("campus123"),
        "role": "student",
        "student_id": "STU-20418",
        "phone": "9876500001",
        "active": True,
        "email_verified": True,
        "verification_status": "prototype_verified",
        "created_at": "2026-09-02T10:00:00.000Z",
        "updated_at": "2026-09-02T10:00:00.000Z",
    },
    {
        "id": "user-student-2",
        "name": "Karan Patel",
        "email": "karan.patel@campus.edu",
        "password": get_password_hash("campus123"),
        "role": "student",
        "student_id": "STU-19882",
        "phone": "9876500002",
        "active": True,
        "email_verified": True,
        "verification_status": "prototype_verified",
        "created_at": "2026-09-12T11:00:00.000Z",
        "updated_at": "2026-09-12T11:00:00.000Z",
    },
]

INITIAL_COMPLAINTS = [
    {
        "id": "cmp-1",
        "ticket": "CSI-2401",
        "title": "Library AC not cooling on level 2",
        "description": "Reading hall on level 2 has been warm since Monday afternoon.",
        "category": "facilities",
        "department_id": "dept-facilities",
        "student_id": "user-student",
        "student_name": "Aisha Rahman",
        "student_email": "student@campus.edu",
        "status": "in_progress",
        "priority": "high",
        "location": "Central Library, Level 2",
        "created_at": "2026-10-24T08:20:00.000Z",
        "updated_at": "2026-10-28T14:10:00.000Z",
        "duplicate_group_id": None,
        "updates": [
            {
                "at": "2026-10-24T08:20:00.000Z",
                "status": "submitted",
                "note": "Complaint submitted by student.",
                "actor": "Aisha Rahman",
            },
            {
                "at": "2026-10-25T09:05:00.000Z",
                "status": "assigned",
                "note": "Assigned to Facilities.",
                "actor": "Campus Admin",
            },
            {
                "at": "2026-10-28T14:10:00.000Z",
                "status": "in_progress",
                "note": "Technician scheduled for filter replacement.",
                "actor": "Meera Joshi",
            },
        ],
    },
    {
        "id": "cmp-2",
        "ticket": "CSI-2402",
        "title": "Hostel Block B water pressure is low",
        "description": "Showers on floors 3 and 4 have very low pressure after 7pm.",
        "category": "hostel",
        "department_id": "dept-hostel",
        "student_id": "user-student",
        "student_name": "Aisha Rahman",
        "student_email": "student@campus.edu",
        "status": "in_review",
        "priority": "medium",
        "location": "Hostel Block B",
        "created_at": "2026-10-25T18:40:00.000Z",
        "updated_at": "2026-10-26T10:00:00.000Z",
        "duplicate_group_id": "dup-water",
        "updates": [
            {
                "at": "2026-10-25T18:40:00.000Z",
                "status": "submitted",
                "note": "Complaint submitted by student.",
                "actor": "Aisha Rahman",
            },
            {
                "at": "2026-10-26T10:00:00.000Z",
                "status": "in_review",
                "note": "Maintenance team reviewing pump schedule.",
                "actor": "Campus Admin",
            },
        ],
    },
    {
        "id": "cmp-3",
        "ticket": "CSI-2403",
        "title": "Wi-Fi disconnected in Lab 4",
        "description": "Access point drops every 10 minutes during programming classes.",
        "category": "it",
        "department_id": "dept-it",
        "student_id": "user-student-2",
        "student_name": "Karan Patel",
        "student_email": "karan.patel@campus.edu",
        "status": "submitted",
        "priority": "critical",
        "location": "Computer Centre, Lab 4",
        "created_at": "2026-10-29T11:15:00.000Z",
        "updated_at": "2026-10-29T11:15:00.000Z",
        "duplicate_group_id": None,
        "updates": [
            {
                "at": "2026-10-29T11:15:00.000Z",
                "status": "submitted",
                "note": "Complaint submitted by student.",
                "actor": "Karan Patel",
            },
        ],
    },
]

INITIAL_AUDIT_LOGS = [
    {
        "id": "aud-1",
        "at": "2026-10-28T14:10:00.000Z",
        "actor": "Meera Joshi",
        "action": "update_complaint",
        "target": "cmp-1",
        "detail": "Status changed to in progress.",
    },
    {
        "id": "aud-2",
        "at": "2026-10-25T09:05:00.000Z",
        "actor": "Campus Admin",
        "action": "update_complaint",
        "target": "cmp-1",
        "detail": "Assigned to Facilities.",
    },
]

# In-memory store fallback when MongoDB Atlas is disconnected or running in isolated tests
in_memory_db: dict[str, list[dict[str, Any]]] = {
    "departments": [dict(d) for d in INITIAL_DEPARTMENTS],
    "users": [dict(u) for u in INITIAL_USERS],
    "complaints": [dict(c) for c in INITIAL_COMPLAINTS],
    "audit_logs": [dict(a) for a in INITIAL_AUDIT_LOGS],
}



def seed_database(force: bool = False) -> dict[str, int]:
    """Seed demo data only outside production."""

    empty_counts = {
        "departments": 0,
        "users": 0,
        "complaints": 0,
        "audit_logs": 0,
    }

    mongo_health = ping_mongo()

    if mongo_health.get("status") != "connected":
        logger.info("MongoDB not connected.")

        if settings.app_env == "production":
            logger.error("Production MongoDB unavailable. Demo seeding disabled.")
            return empty_counts

        logger.info("Using in-memory demo data for development.")
        return {
            "departments": len(in_memory_db["departments"]),
            "users": len(in_memory_db["users"]),
            "complaints": len(in_memory_db["complaints"]),
            "audit_logs": len(in_memory_db["audit_logs"]),
        }

    try:
        db = get_database()
        init_db_indexes(db)

        users_col = get_users_collection()
        depts_col = get_departments_collection()
        cmps_col = get_complaints_collection()
        audits_col = get_audit_logs_collection()

        # Production: never insert, overwrite, or delete demo data.
        if settings.app_env == "production":
            counts = {
                "departments": depts_col.count_documents({}),
                "users": users_col.count_documents({}),
                "complaints": cmps_col.count_documents({}),
                "audit_logs": audits_col.count_documents({}),
            }

            logger.info("Production mode: demo seeding skipped. Records: %s", counts)
            return counts

        counts = {}

        if force:
            depts_col.delete_many({})
            users_col.delete_many({})
            cmps_col.delete_many({})
            audits_col.delete_many({})

        # Development: seed departments
        for dept in INITIAL_DEPARTMENTS:
            depts_col.replace_one({"id": dept["id"]}, dict(dept), upsert=True)
        counts["departments"] = depts_col.count_documents({})

        # Development: seed demo users
        for user in INITIAL_USERS:
            users_col.replace_one({"id": user["id"]}, dict(user), upsert=True)
        counts["users"] = users_col.count_documents({})

        # Development: seed complaints if empty or forced
        if force or cmps_col.count_documents({}) == 0:
            for c in INITIAL_COMPLAINTS:
                cmps_col.replace_one({"id": c["id"]}, dict(c), upsert=True)
        counts["complaints"] = cmps_col.count_documents({})

        # Development: seed audit logs if empty or forced
        if force or audits_col.count_documents({}) == 0:
            for a in INITIAL_AUDIT_LOGS:
                audits_col.replace_one({"id": a["id"]}, dict(a), upsert=True)
        counts["audit_logs"] = audits_col.count_documents({})

        logger.info("MongoDB Atlas seeded successfully: %s", counts)
        return counts

    except Exception as exc:
        logger.exception("MongoDB seed failed: %s", exc)

        if settings.app_env == "production":
            return empty_counts

        return {
            "departments": len(in_memory_db["departments"]),
            "users": len(in_memory_db["users"]),
            "complaints": len(in_memory_db["complaints"]),
            "audit_logs": len(in_memory_db["audit_logs"]),
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Campus Signal Intelligence database")
    parser.add_argument("--force", action="store_true", help="Force wipe and re-seed demo data")
    args = parser.parse_args()

    result = seed_database(force=args.force)
    print("Seed result:", result)

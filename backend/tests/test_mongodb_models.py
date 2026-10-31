import pytest
from pydantic import ValidationError

from app.models.audit import AuditLogModel
from app.models.complaint import ComplaintModel, ComplaintUpdateModel
from app.models.department import DepartmentModel
from app.models.user import UserModel


def test_user_model_serialization_and_security() -> None:
    user = UserModel(
        id="user-test-1",
        name="Test User",
        email="test@campus.edu",
        password="pbkdf2_sha256$100000$saltsaltsalt$hashhashhash",
        role="student",
        student_id="STU-11223",
    )
    doc = user.to_doc()
    assert doc["id"] == "user-test-1"
    assert doc["email"] == "test@campus.edu"
    assert doc["password"].startswith("pbkdf2_sha256$")

    # Ensure to_response_dict NEVER returns password or _id
    resp = user.to_response_dict()
    assert "password" not in resp
    assert "_id" not in resp
    assert resp["id"] == "user-test-1"
    assert resp["role"] == "student"


def test_user_model_from_doc() -> None:
    mongo_doc = {
        "_id": "6722667d4f9b8c0012345678",
        "id": "user-custom-id",
        "name": "Prof Smith",
        "email": "smith@campus.edu",
        "password": "pbkdf2_sha256$100000$saltsalt$hashhash",
        "role": "faculty",
        "faculty_id": "FAC-500",
        "department_id": "dept-academic",
        "active": True,
        "email_verified": True,
        "verification_status": "prototype_verified",
        "created_at": "2026-10-30T10:00:00.000Z",
        "updated_at": "2026-10-30T10:00:00.000Z",
    }
    user = UserModel.from_doc(mongo_doc)
    assert user.id == "user-custom-id"
    assert user.role == "faculty"
    assert user.faculty_id == "FAC-500"
    assert user.email_verified is True


def test_user_model_role_validation() -> None:
    # Invalid role must raise ValidationError
    with pytest.raises(ValidationError):
        UserModel(
            id="user-invalid",
            name="Hacker",
            email="hacker@campus.edu",
            password="hashed_pass",
            role="super_superuser",  # type: ignore
        )


def test_complaint_model_serialization_and_lifecycle() -> None:
    complaint = ComplaintModel(
        id="cmp-test-1",
        ticket="CSI-9999",
        title="Projector in Room 301 is broken",
        description="The HDMI port on the ceiling projector is loose and no display is output.",
        category="it",
        department_id="dept-it",
        location="Room 301",
        student_id="user-student",
        student_name="Aisha Rahman",
        student_email="student@campus.edu",
        status="submitted",
        priority="high",
        updates=[
            ComplaintUpdateModel(
                at="2026-10-30T10:00:00.000Z",
                status="submitted",
                note="Ticket filed by student",
                actor="Aisha Rahman",
            )
        ],
    )
    doc = complaint.to_doc()
    assert doc["ticket"] == "CSI-9999"
    assert doc["category"] == "it"
    assert len(doc["updates"]) == 1
    assert doc["updates"][0]["actor"] == "Aisha Rahman"

    # From MongoDB doc with _id
    mongo_doc = dict(doc)
    mongo_doc["_id"] = "mongo_object_id_string"
    loaded = ComplaintModel.from_doc(mongo_doc)
    assert loaded.id == "cmp-test-1"
    assert loaded.ticket == "CSI-9999"


def test_department_model_normalization() -> None:
    dept = DepartmentModel(
        id="dept-chem",
        name="Chemistry Lab",
        code="chm",
        head="Dr. Alice Wong",
        email="CHEMISTRY@CAMPUS.EDU",
    )
    doc = dept.to_doc()
    assert doc["code"] == "CHM"
    assert doc["email"] == "chemistry@campus.edu"
    assert doc["active"] is True


def test_audit_log_model() -> None:
    audit = AuditLogModel(
        id="aud-test-99",
        actor="Campus Admin",
        action="update_status",
        target="CSI-2401",
        detail="Changed status to in_progress",
    )
    doc = audit.to_doc()
    assert doc["id"] == "aud-test-99"
    assert doc["actor"] == "Campus Admin"
    assert doc["action"] == "update_status"


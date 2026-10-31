from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

UserRoleType = Literal["student", "faculty", "staff", "admin"]


class UserModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    name: str
    email: str = Field(..., min_length=3)
    password: str
    role: UserRoleType = "student"
    student_id: str | None = None
    faculty_id: str | None = None
    staff_id: str | None = None
    department_id: str | None = None
    phone: str | None = None
    active: bool = True
    email_verified: bool = False
    verification_status: str = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_doc(self) -> dict[str, Any]:
        """Convert model to MongoDB document dict."""
        doc = self.model_dump()
        doc["email"] = doc["email"].lower()
        return doc

    def to_response_dict(self) -> dict[str, Any]:
        """Convert model to safe dictionary without sensitive credential fields."""
        data = self.model_dump()
        data.pop("password", None)
        data.pop("_id", None)
        return data

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> "UserModel":
        """Instantiate UserModel from MongoDB document."""
        data = dict(doc)
        if "_id" in data and "id" not in data:
            data["id"] = str(data["_id"])
        data.pop("_id", None)
        return cls(**data)

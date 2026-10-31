from typing import Literal
from pydantic import Field

from app.schemas.common import CamelModel

ComplaintStatus = Literal[
    "submitted",
    "in_review",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
]

Priority = Literal["low", "medium", "high", "critical"]

Category = Literal[
    "facilities",
    "academics",
    "hostel",
    "it",
    "safety",
    "transport",
    "other",
]


class ComplaintUpdate(CamelModel):
    at: str
    status: ComplaintStatus
    note: str
    actor: str


class ComplaintBase(CamelModel):
    title: str = Field(..., min_length=3)
    description: str = Field(..., min_length=5)
    category: Category
    department_id: str
    location: str
    image_url: str | None = None


class ComplaintDraft(ComplaintBase):
    pass


class ComplaintResponse(ComplaintBase):
    id: str
    ticket: str
    student_id: str
    student_name: str
    student_email: str
    status: ComplaintStatus = "submitted"
    priority: Priority = "medium"
    created_at: str
    updated_at: str
    duplicate_group_id: str | None = None
    updates: list[ComplaintUpdate] = Field(default_factory=list)


class ComplaintPatch(CamelModel):
    status: ComplaintStatus | None = None
    priority: Priority | None = None
    department_id: str | None = None
    duplicate_group_id: str | None = None
    note: str | None = None


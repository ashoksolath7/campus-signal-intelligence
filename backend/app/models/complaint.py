from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

ComplaintStatusType = Literal[
    "submitted",
    "in_review",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
]

PriorityType = Literal["low", "medium", "high", "critical"]

CategoryType = Literal[
    "facilities",
    "academics",
    "hostel",
    "it",
    "safety",
    "transport",
    "other",
]


class ComplaintUpdateModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: ComplaintStatusType
    note: str
    actor: str


class ComplaintModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    ticket: str
    title: str
    description: str
    category: CategoryType
    department_id: str
    location: str
    image_url: str | None = None
    student_id: str
    student_name: str
    student_email: str
    status: ComplaintStatusType = "submitted"
    priority: PriorityType = "medium"
    duplicate_group_id: str | None = None
    updates: list[ComplaintUpdateModel] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_doc(self) -> dict[str, Any]:
        """Convert model to MongoDB document dict."""
        doc = self.model_dump()
        return doc

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> "ComplaintModel":
        """Instantiate ComplaintModel from MongoDB document."""
        data = dict(doc)
        if "_id" in data and "id" not in data:
            data["id"] = str(data["_id"])
        data.pop("_id", None)
        return cls(**data)


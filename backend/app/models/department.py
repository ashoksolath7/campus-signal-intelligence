from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class DepartmentModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    name: str
    code: str
    head: str
    email: str = Field(..., min_length=3)
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_doc(self) -> dict[str, Any]:
        """Convert model to MongoDB document dict."""
        doc = self.model_dump()
        doc["code"] = doc["code"].upper()
        doc["email"] = doc["email"].lower()
        return doc

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> "DepartmentModel":
        """Instantiate DepartmentModel from MongoDB document."""
        data = dict(doc)
        if "_id" in data and "id" not in data:
            data["id"] = str(data["_id"])
        data.pop("_id", None)
        return cls(**data)

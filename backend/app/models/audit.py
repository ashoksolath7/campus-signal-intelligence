from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class AuditLogModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    actor: str
    action: str
    target: str
    detail: str
    ip_address: str | None = None

    def to_doc(self) -> dict[str, Any]:
        """Convert model to MongoDB document dict."""
        return self.model_dump()

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> "AuditLogModel":
        """Instantiate AuditLogModel from MongoDB document."""
        data = dict(doc)
        if "_id" in data and "id" not in data:
            data["id"] = str(data["_id"])
        data.pop("_id", None)
        return cls(**data)


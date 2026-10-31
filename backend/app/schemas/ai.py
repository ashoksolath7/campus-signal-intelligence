from typing import Any
from pydantic import Field
from app.schemas.common import CamelModel


class AIClassifyRequest(CamelModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    location: str | None = None


class AIClassifyResponse(CamelModel):
    category: str
    category_confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    category_reasons: list[str] = Field(default_factory=list)
    priority: str
    priority_reasons: list[str] = Field(default_factory=list)
    urgency_score: float = Field(..., ge=0.0, le=1.0)
    summary: str
    reasoning: str
    department_hint: str | None = None
    department_code: str | None = None
    department_reasoning: str | None = None
    model_used: str


class AIDuplicateDetectRequest(CamelModel):
    title: str = Field(..., min_length=1)
    description: str = Field(default="")
    category: str | None = None
    location: str | None = None
    threshold: float = Field(default=0.50, ge=0.0, le=1.0)
    limit: int = Field(default=5, ge=1, le=20)


class DuplicateMatch(CamelModel):
    complaint_id: str
    ticket: str
    title: str
    category: str
    status: str
    priority: str
    similarity_score: float
    dense_similarity: float = 0.0
    duplicate_group_id: str | None = None
    matching_keywords: list[str] = Field(default_factory=list)
    summary: str
    evidence: str = ""
    engine: str = ""


class AIDuplicateDetectResponse(CamelModel):
    matches: list[DuplicateMatch] = Field(default_factory=list)
    has_duplicates: bool
    top_similarity: float = 0.0
    engine: str


class SuggestedDuplicateGroup(CamelModel):
    group_id: str
    primary_ticket: str
    primary_id: str
    member_tickets: list[str]
    member_ids: list[str]
    common_theme: str
    average_similarity: float
    evidence: str = ""
    engine: str = ""


class AISuggestedDuplicatesResponse(CamelModel):
    suggested_groups: list[SuggestedDuplicateGroup] = Field(default_factory=list)
    total_candidates: int
    engine: str

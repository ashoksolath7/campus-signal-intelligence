import logging
from typing import Any

from app.ai.classifier import GeminiClassifier
from app.ai.duplicate_detector import DuplicateDetector
from app.ai.embedding import EmbeddingEngine
from app.schemas.ai import (
    AIClassifyRequest,
    AIClassifyResponse,
    AIDuplicateDetectRequest,
    AIDuplicateDetectResponse,
    AISuggestedDuplicatesResponse,
    DuplicateMatch,
    SuggestedDuplicateGroup,
)
from app.services.complaints import list_complaints

logger = logging.getLogger(__name__)


def classify_complaint_text(req: AIClassifyRequest) -> AIClassifyResponse:
    """Classifies a complaint draft, recommending category, priority, urgency, and department with full explainability."""
    res = GeminiClassifier.classify(
        title=req.title,
        description=req.description,
        location=req.location,
    )
    return AIClassifyResponse(
        category=res["category"],
        category_confidence=res.get("category_confidence", 0.85),
        category_reasons=res.get("category_reasons", []),
        priority=res["priority"],
        priority_reasons=res.get("priority_reasons", []),
        urgency_score=res["urgency_score"],
        summary=res["summary"],
        reasoning=res["reasoning"],
        department_hint=res.get("department_hint"),
        department_code=res.get("department_code"),
        department_reasoning=res.get("department_reasoning"),
        model_used=res["model_used"],
    )


def detect_duplicates_for_draft(req: AIDuplicateDetectRequest) -> AIDuplicateDetectResponse:
    """Checks a candidate complaint against active MongoDB queue using dense sentence embeddings and semantic evidence."""
    all_complaints = list_complaints()

    matches_raw = DuplicateDetector.find_duplicates(
        title=req.title,
        description=req.description,
        category=req.category,
        location=req.location,
        candidates=all_complaints,
        threshold=req.threshold,
        limit=req.limit,
    )

    matches = [DuplicateMatch.model_validate(m) for m in matches_raw]
    top_score = matches[0].similarity_score if matches else 0.0

    return AIDuplicateDetectResponse(
        matches=matches,
        has_duplicates=len(matches) > 0,
        top_similarity=top_score,
        engine=EmbeddingEngine.get_engine_name(),
    )


def get_suggested_duplicate_groups(threshold: float = 0.55) -> AISuggestedDuplicatesResponse:
    """Batch-scans all complaints across MongoDB to discover candidate duplicate clusters for admin approval.
    
    NOTE: Suggested clusters are never merged automatically. Administrator approval is strictly required.
    """
    all_complaints = list_complaints()

    groups_raw = DuplicateDetector.cluster_candidates(
        complaints=all_complaints,
        threshold=threshold,
    )

    suggested_groups = [SuggestedDuplicateGroup.model_validate(g) for g in groups_raw]
    total_candidates = sum(len(g.member_ids) + 1 for g in suggested_groups)

    return AISuggestedDuplicatesResponse(
        suggested_groups=suggested_groups,
        total_candidates=total_candidates,
        engine=EmbeddingEngine.get_engine_name(),
    )

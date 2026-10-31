from typing import Any
from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user, require_role
from app.schemas.ai import (
    AIClassifyRequest,
    AIClassifyResponse,
    AIDuplicateDetectRequest,
    AIDuplicateDetectResponse,
    AISuggestedDuplicatesResponse,
)
from app.services.ai import (
    classify_complaint_text,
    detect_duplicates_for_draft,
    get_suggested_duplicate_groups,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/classify",
    response_model=AIClassifyResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Triage & Categorization",
    description="Analyzes complaint title and description to suggest category, priority, urgency score, and department.",
)
def post_classify_complaint(
    payload: AIClassifyRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> AIClassifyResponse:
    return classify_complaint_text(payload)


@router.post(
    "/detect-duplicates",
    response_model=AIDuplicateDetectResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Duplicate Detection",
    description="Detects existing complaints semantically similar to a draft ticket to prevent duplication.",
)
def post_detect_duplicates(
    payload: AIDuplicateDetectRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> AIDuplicateDetectResponse:
    return detect_duplicates_for_draft(payload)


@router.get(
    "/suggested-duplicates",
    response_model=AISuggestedDuplicatesResponse,
    summary="Batch AI Duplicate Cluster Discovery",
    description="Scans active complaints to discover clusters of suspected duplicate tickets for admin review.",
)
def get_suggested_duplicates(
    threshold: float = Query(0.55, ge=0.0, le=1.0),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> AISuggestedDuplicatesResponse:
    require_role("admin")(current_user)
    return get_suggested_duplicate_groups(threshold=threshold)

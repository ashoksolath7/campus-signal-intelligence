from typing import Any
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.analytics import AnalyticsSummary
from app.services.analytics import get_analytics_summary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "",
    response_model=AnalyticsSummary,
    summary="Get campus operations analytics",
    description="Returns aggregated metrics, category distribution, daily trends, priority breakdowns, and department load.",
)
def get_analytics(
    student_id: str | None = Query(None, alias="studentId"),
    _: dict[str, Any] = Depends(get_current_user),
) -> AnalyticsSummary:
    return get_analytics_summary(student_id=student_id)


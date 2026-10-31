from datetime import datetime, timedelta, timezone
from typing import Any

from app.schemas.analytics import (
    AnalyticsSummary,
    CategoryStat,
    DepartmentStat,
    PriorityStat,
    TrendStat,
)
from app.services.complaints import list_complaints
from app.services.departments import list_departments

CATEGORY_LABELS = {
    "facilities": "Facilities",
    "academics": "Academics",
    "hostel": "Hostel",
    "it": "IT Services",
    "safety": "Campus Safety",
    "transport": "Transport",
    "other": "Other",
}

PRIORITY_ORDER = ["low", "medium", "high", "critical"]
PRIORITY_LABELS = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "critical": "Critical",
}


def get_analytics_summary(student_id: str | None = None) -> AnalyticsSummary:
    complaints = list_complaints(student_id=student_id)
    departments = list_departments()

    total = len(complaints)
    pending = sum(1 for c in complaints if c.get("status") not in ("resolved", "closed"))
    resolved = sum(1 for c in complaints if c.get("status") in ("resolved", "closed"))
    critical = sum(1 for c in complaints if c.get("priority") == "critical")

    # Category distribution
    cat_counts: dict[str, int] = {}
    for c in complaints:
        cat = c.get("category", "other")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    cat_stats = [
        CategoryStat(
            category=cat,
            name=CATEGORY_LABELS.get(cat, cat.capitalize()),
            value=count,
        )
        for cat, count in cat_counts.items()
    ]

    # Priority distribution
    prio_stats = [
        PriorityStat(
            priority=prio,
            name=PRIORITY_LABELS.get(prio, prio.capitalize()),
            count=sum(1 for c in complaints if c.get("priority") == prio),
        )
        for prio in PRIORITY_ORDER
    ]

    # Department distribution
    dept_stats = [
        DepartmentStat(
            department_id=dept["id"],
            name=dept["name"],
            code=dept["code"],
            count=sum(1 for c in complaints if c.get("department_id") == dept["id"]),
        )
        for dept in departments
    ]

    # Daily trends for the last 7 days
    now = datetime.now(timezone.utc)
    trend_stats: list[TrendStat] = []
    for i in range(6, -1, -1):
        day_date = now - timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        day_name = day_date.strftime("%a")
        day_count = sum(1 for c in complaints if c.get("created_at", "").startswith(day_str))
        trend_stats.append(
            TrendStat(
                date=day_str,
                day=day_name,
                complaints=day_count,
            )
        )

    return AnalyticsSummary(
        total_complaints=total,
        pending_complaints=pending,
        resolved_complaints=resolved,
        critical_complaints=critical,
        category_distribution=cat_stats,
        priority_distribution=prio_stats,
        department_distribution=dept_stats,
        daily_trends=trend_stats,
    )


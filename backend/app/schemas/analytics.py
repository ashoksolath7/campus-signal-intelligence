from app.schemas.common import CamelModel


class CategoryStat(CamelModel):
    name: str
    category: str
    value: int


class PriorityStat(CamelModel):
    name: str
    priority: str
    count: int


class DepartmentStat(CamelModel):
    name: str
    code: str
    department_id: str
    count: int


class TrendStat(CamelModel):
    day: str
    date: str
    complaints: int


class AnalyticsSummary(CamelModel):
    total_complaints: int
    pending_complaints: int
    resolved_complaints: int
    critical_complaints: int
    category_distribution: list[CategoryStat]
    priority_distribution: list[PriorityStat]
    department_distribution: list[DepartmentStat]
    daily_trends: list[TrendStat]


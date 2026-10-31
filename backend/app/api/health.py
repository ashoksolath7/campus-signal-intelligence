from fastapi import APIRouter, status

from app.core.config import settings
from app.database.mongodb import ping_mongo
from app.schemas.health import HealthResponse, MongoHealth

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Service health",
    description="Reports API liveness and MongoDB Atlas connectivity for campus_signal_db. The API stays up if MongoDB is down or not configured. Credentials are never returned.",
)
def get_health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="campus-signal-intelligence-api",
        version=settings.app_version,
        environment=settings.app_env,
        mongodb=MongoHealth.model_validate(ping_mongo()),
    )

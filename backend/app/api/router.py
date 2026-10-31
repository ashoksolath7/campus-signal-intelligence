from fastapi import APIRouter

from app.api.ai import router as ai_router
from app.api.analytics import router as analytics_router
from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.complaints import router as complaints_router
from app.api.departments import router as departments_router
from app.api.health import router as health_router
from app.api.users import router as users_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(complaints_router)
api_router.include_router(departments_router)
api_router.include_router(users_router)
api_router.include_router(analytics_router)
api_router.include_router(audit_router)
api_router.include_router(ai_router)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.database.mongodb import close_mongo, ping_mongo
from app.database.seed import seed_database
from app.middleware.demo_mode import DemoModeMiddleware
from app.middleware.request_id import RequestIdMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    ping_mongo()
    seed_database()
    yield
    close_mongo()


openapi_tags = [
    {
        "name": "health",
        "description": "Liveness and dependency checks used by local setup and later monitoring.",
    },
    {
        "name": "auth",
        "description": "Authentication, registration, session management, and JWT token issuance.",
    },
    {
        "name": "complaints",
        "description": "Student complaint submission, status tracking, and triage workflow operations.",
    },
    {
        "name": "departments",
        "description": "Campus departments registry and routing configuration.",
    },
    {
        "name": "users",
        "description": "User directory and role management.",
    },
    {
        "name": "analytics",
        "description": "Real-time operations metrics, category distribution, daily trends, and priority breakdowns.",
    },
    {
        "name": "audit",
        "description": "Operations audit trails and event history.",
    },
]

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Campus Signal Intelligence API. This foundation exposes health, configuration, "
        "MongoDB connectivity, CORS, and a stable error envelope. Feature routes are not stubbed."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=openapi_tags,
    lifespan=lifespan,
)

app.add_middleware(RequestIdMiddleware)
app.add_middleware(DemoModeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
    expose_headers=["x-request-id", "x-persistence-mode"],
)

register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "redoc": "/redoc",
        "health": f"{settings.api_prefix}/health",
        "openapi": "/openapi.json",
    }

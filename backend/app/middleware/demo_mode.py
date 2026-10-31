
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.persistence import demo_mode_ctx


class DemoModeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        header_val = request.headers.get("x-demo-mode", "").strip().lower()
        query_val = request.query_params.get("demo_mode", "").strip().lower()

        is_demo = False

        # Demo mode is never allowed in production.
        if settings.app_env != "production":
            is_demo = (
                header_val in ("true", "1", "yes")
                or query_val in ("true", "1", "yes")
            )

        token = demo_mode_ctx.set(is_demo)

        try:
            response = await call_next(request)

            if is_demo:
                response.headers["x-persistence-mode"] = "demo_fallback"

            return response
        finally:
            demo_mode_ctx.reset(token)

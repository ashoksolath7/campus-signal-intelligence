import logging

from app.core.config import settings


def configure_logging() -> None:
    level = logging.DEBUG if settings.app_debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    # Silence verbose pymongo topology heartbeats from clogging stdout and event loops
    logging.getLogger("pymongo").setLevel(logging.INFO)

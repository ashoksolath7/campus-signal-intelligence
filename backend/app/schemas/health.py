from typing import Literal

from pydantic import BaseModel, Field


class MongoHealth(BaseModel):
    status: Literal["connected", "disconnected", "not_configured"]
    configured: bool
    database: str


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    environment: str
    mongodb: MongoHealth = Field(
        ...,
        description="MongoDB Atlas connectivity for campus_signal_db. Never includes credentials.",
    )

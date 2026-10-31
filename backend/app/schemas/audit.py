from app.schemas.common import CamelModel


class AuditLogResponse(CamelModel):
    id: str
    at: str
    actor: str
    action: str
    target: str
    detail: str


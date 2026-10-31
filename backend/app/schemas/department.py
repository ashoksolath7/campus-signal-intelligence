from pydantic import Field

from app.schemas.common import CamelModel


class DepartmentBase(CamelModel):
    name: str = Field(..., min_length=2)
    code: str = Field(..., min_length=2)
    head: str = Field(..., min_length=2)
    email: str = Field(..., min_length=3)
    active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentResponse(DepartmentBase):
    id: str


class DepartmentPatch(CamelModel):
    name: str | None = None
    code: str | None = None
    head: str | None = None
    email: str | None = None
    active: bool | None = None

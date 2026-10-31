from typing import Any, Literal
from pydantic import Field

from app.schemas.common import CamelModel

UserRole = Literal["student", "faculty", "staff", "admin"]


class UserBase(CamelModel):
    name: str
    email: str
    role: UserRole
    student_id: str | None = None
    faculty_id: str | None = None
    staff_id: str | None = None
    department_id: str | None = None
    phone: str | None = None
    active: bool = True
    email_verified: bool = False
    verification_status: str | None = "otp_verified"


class UserCreate(CamelModel):
    name: str = Field(..., min_length=2)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    role: UserRole = "student"
    student_id: str | None = None
    faculty_id: str | None = None
    staff_id: str | None = None
    department_id: str | None = None
    phone: str | None = None


class UserResponse(UserBase):
    id: str
    created_at: str | None = None
    updated_at: str | None = None


class UserPatch(CamelModel):
    name: str | None = None
    phone: str | None = None
    active: bool | None = None
    role: UserRole | None = None
    department_id: str | None = None
    student_id: str | None = None
    faculty_id: str | None = None
    staff_id: str | None = None


class LoginRequest(CamelModel):
    email: str
    password: str
    role: UserRole


class RegisterRequest(CamelModel):
    name: str = Field(..., min_length=2)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    student_id: str | None = None
    faculty_id: str | None = None
    staff_id: str | None = None
    role: UserRole = "student"
    department_id: str | None = None
    phone: str | None = None
    otp: str | None = None
    verification_token: str | None = None


class AuthResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SendOtpRequest(CamelModel):
    email: str


class SendOtpResponse(CamelModel):
    message: str
    email: str
    cooldown_seconds: int = 60
    expires_in_seconds: int = 300
    delivery: dict[str, Any] | None = None


class VerifyOtpRequest(CamelModel):
    email: str
    otp: str


class VerifyOtpResponse(CamelModel):
    message: str
    email: str
    verified: bool = True
    verification_token: str | None = None


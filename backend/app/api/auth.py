from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user
from app.core.security import create_access_token
from app.schemas.user import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    SendOtpRequest,
    SendOtpResponse,
    UserResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services.auth import authenticate_user, register_user
from app.services.otp import request_registration_otp, verify_registration_otp

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/send-otp",
    response_model=SendOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate and send registration OTP via email delivery",
    description="Dispatches a cryptographically secure 6-digit OTP code to the provided email address via SMTP.",
)
def send_otp(payload: SendOtpRequest) -> SendOtpResponse:
    result = request_registration_otp(email=payload.email)
    return SendOtpResponse.model_validate(result)


@router.post(
    "/verify-otp",
    response_model=VerifyOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify registration email OTP",
    description="Validates the 6-digit OTP code, enforces expiration and rate limits, and issues an authorization token.",
)
def verify_otp(payload: VerifyOtpRequest) -> VerifyOtpResponse:
    result = verify_registration_otp(email=payload.email, otp=payload.otp)
    return VerifyOtpResponse.model_validate(result)


@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in to Student or Admin portal",
    description="Authenticates credentials against the requested portal role and issues a JWT Bearer token.",
)
def login(payload: LoginRequest) -> AuthResponse:
    user = authenticate_user(
        email=payload.email,
        password=payload.password,
        role=payload.role,
    )
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
    })
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account with verified email OTP",
    description="Registers a new user after email OTP verification, hashes credentials, and issues an active session token.",
)
def register(payload: RegisterRequest) -> AuthResponse:
    user, token = register_user(payload)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
    description="Returns the profile information for the Bearer token owner.",
)
def get_me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)

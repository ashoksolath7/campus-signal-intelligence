from functools import lru_cache
from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Campus Signal Intelligence"
    app_env: str = "development"
    app_version: str = "0.1.0"
    app_debug: bool = True
    api_prefix: str = "/api/v1"

    host: str = "0.0.0.0"
    port: int = 8000

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:4173,http://127.0.0.1:4173,"
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    
    cors_origin_regex: str = (
        r"^https?://(localhost|127\.0\.0\.1|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})"
        r"(:[0-9]+)?$"
    )

    mongodb_uri: str = ""
    mongodb_db_name: str = "campus_signal_db"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    jwt_secret_key: str = "campus-signal-intelligence-secret-key-32charsminimum"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Email & SMTP Delivery Configuration
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Campus Signal Intelligence"
    smtp_tls: bool = True
    smtp_ssl: bool = False
    smtp_timeout_seconds: int = 15

    # OTP Security Parameters
    otp_expire_minutes: int = 5
    otp_resend_cooldown_seconds: int = 60
    otp_max_attempts: int = 5

    # Any email domain allowed (empty or "*" accepts all valid emails)
    allowed_email_domains: str = "*"

    @computed_field
    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host.strip() and self.smtp_user.strip())

    @computed_field
    @property
    def allowed_email_domain_list(self) -> list[str]:
        if not self.allowed_email_domains.strip() or self.allowed_email_domains.strip() == "*":
            return []
        return [domain.strip().lower() for domain in self.allowed_email_domains.split(",") if domain.strip()]

    @computed_field
    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @computed_field
    @property
    def mongodb_configured(self) -> bool:
        return bool(self.mongodb_uri.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

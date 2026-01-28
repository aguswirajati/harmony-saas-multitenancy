from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    APP_NAME: str = "SaaS Multi-Tenant API"
    DEBUG: bool = False

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Email Configuration
    MAIL_ENABLED: bool = True
    MAIL_FROM: str = "noreply@harmony-saas.com"
    MAIL_FROM_NAME: str = "Harmony SaaS"
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    # Frontend URL for email links
    FRONTEND_URL: str = "http://localhost:3000"

    # Sentry (optional - leave empty to disable)
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

    def validate_production_settings(self):
        """Validate critical settings for production deployment."""
        if not self.DEBUG:
            if "dev-secret" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY is insecure for production. "
                    "Generate a strong key with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )

@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    s.validate_production_settings()
    return s

settings = get_settings()

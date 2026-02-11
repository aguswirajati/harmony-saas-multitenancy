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

    # Developer mode: disables rate limiting and enables dev tools
    DEV_MODE: bool = False
    RATE_LIMIT_ENABLED: bool = True

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

    # S3-Compatible Storage Configuration
    S3_ENDPOINT_URL: str = "http://localhost:9000"  # MinIO for local dev
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_SECRET_ACCESS_KEY: str = "minioadmin123"
    S3_BUCKET_NAME: str = "harmony-uploads"
    S3_REGION: str = "us-east-1"
    S3_PUBLIC_URL: str = ""  # Optional public URL for serving files
    S3_PRESIGNED_URL_EXPIRY: int = 3600  # URL expiry in seconds (1 hour)

    # File Upload Limits
    MAX_UPLOAD_SIZE_MB: int = 50  # Max file size in MB
    MAX_IMAGE_SIZE_MB: int = 10  # Max image size in MB
    ALLOWED_IMAGE_EXTENSIONS: list[str] = ["jpg", "jpeg", "png", "gif", "webp", "svg"]
    ALLOWED_DOCUMENT_EXTENSIONS: list[str] = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "zip"]

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

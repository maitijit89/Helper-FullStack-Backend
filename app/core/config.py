import logging
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    PROJECT_NAME: str = "FastAPI Production Base (MongoDB)"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security
    SECRET_KEY: str = "supersecretkey-change-this-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Designated Admin Email
    ADMIN_EMAIL: str = "helpingservicesteam@gmail.com"

    # CORS origins list
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # MongoDB Configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "fastapi_db"

    # SMTP / Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_TLS: bool = True
    SMTP_USER: str = "helpingservicesteam@gmail.com"
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "helpingservicesteam@gmail.com"
    EMAILS_FROM_NAME: str = "Helping Services Team"

    # AWS S3 Storage Configuration
    STORAGE_PROVIDER: str = "s3"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_STORAGE_BUCKET_NAME: str = ""
    AWS_S3_REGION_NAME: str = "ap-south-1"

    # Upstash / Redis Configuration
    REDIS_URL: str = ""

    # Mappls / MapmyIndia Configuration
    MAPPLS_REST_API_KEY: str = ""

    # Google Gemini AI Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # Google Sheets Configuration
    GOOGLE_SHEETS_SPREADSHEET_ID: str = ""
    GOOGLE_SHEETS_SHEET_NAME: str = "Partner Applications"
    GOOGLE_SERVICE_ACCOUNT_FILE: str = ""
    GOOGLE_SERVICE_ACCOUNT_INFO: str = ""
    GOOGLE_SHEET_WEBHOOK_URL: str = ""

    # Razorpay Payment Gateway Configuration
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Rate Limiting Configuration
    RATE_LIMIT_PER_MINUTE: int = 60
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()

if settings.ENVIRONMENT.lower() == "production":
    if settings.DEBUG:
        logger.warning("SECURITY WARNING: DEBUG is enabled in PRODUCTION environment!")
    if "supersecretkey" in settings.SECRET_KEY.lower():
        logger.warning("SECURITY WARNING: Default SECRET_KEY is being used in PRODUCTION environment!")


import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Argus CyberSecOps Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret keys and cryptography
    SECRET_KEY: str = "argus-cybersecops-super-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Database: SQLite with async support by default, or PostgreSQL
    DATABASE_URL: str = "sqlite+aiosqlite:///./argus.db"
    
    # Redis / Celery broker URL (optional/fallback)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Storage paths
    REPORTS_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage/reports"))
    KEYS_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage/keys"))
    SNAPSHOTS_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage/snapshots"))
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

# Ensure required directories exist
for path in [settings.REPORTS_DIR, settings.KEYS_DIR, settings.SNAPSHOTS_DIR]:
    os.makedirs(path, exist_ok=True)

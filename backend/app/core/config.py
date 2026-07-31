from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Monlam Melong (primary LLM for all agents)
    monlam_api_key: str = ""
    monlam_api_base: str = "https://api-v1.monlamai.studio"
    monlam_model: str = "melong"

    database_url: str = "postgresql+asyncpg://lobsangtashi@localhost:5432/monlam_rignor"
    database_url_sync: str = "postgresql://lobsangtashi@localhost:5432/monlam_rignor"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_from: str = "noreply@monlam-rignor.local"
    otp_expire_minutes: int = 10
    otp_dev_log: bool = True

    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024

    grammar_pdf_path: str = str(ROOT / "classical-tibetan-grammar-handbook_compress.pdf")
    content_path: str = str(ROOT / "data" / "content")

    app_name: str = "Monlam Rignor"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    @field_validator("monlam_api_key", mode="before")
    @classmethod
    def clean_api_key(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip().strip('"').strip("'")

    @property
    def monlam_chat_url(self) -> str:
        return f"{self.monlam_api_base.rstrip('/')}/api/v1/ai/chat"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def resolve_path(self, value: str) -> Path:
        path = Path(value).expanduser()
        if path.is_absolute():
            return path
        return (ROOT / path).resolve()

    @property
    def grammar_pdf(self) -> Path:
        return self.resolve_path(self.grammar_pdf_path)

    @property
    def content_dir(self) -> Path:
        return self.resolve_path(self.content_path)


@lru_cache
def get_settings() -> Settings:
    return Settings()

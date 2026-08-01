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
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@monlam-rignor.local"
    smtp_from_email: str = ""
    smtp_from_name: str = ""
    smtp_use_tls: bool | None = None  # None = auto (True for 587)
    otp_expire_minutes: int = 10
    otp_dev_log: bool = True

    @property
    def smtp_sender(self) -> str:
        email = (self.smtp_from_email or self.smtp_from or "").strip()
        name = (self.smtp_from_name or "").strip().strip('"')
        if name and email:
            return f"{name} <{email}>"
        return email or self.smtp_from

    @property
    def smtp_start_tls(self) -> bool:
        if self.smtp_use_tls is not None:
            return bool(self.smtp_use_tls)
        return int(self.smtp_port) == 587

    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024
    # Skip HuggingFace network checks when the model is already cached (much faster).
    embedding_local_files_only: bool = True
    # Warm the embedder in a background thread when the API starts.
    embedding_preload: bool = True
    # If still warming, skip RAG after this many seconds (0 = wait until loaded).
    embedding_request_wait_s: float = 0.0

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
    def monlam_tts_url(self) -> str:
        return f"{self.monlam_api_base.rstrip('/')}/api/v1/text-to-speech/"

    @property
    def monlam_stt_url(self) -> str:
        return f"{self.monlam_api_base.rstrip('/')}/api/v1/speech-to-text/"

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

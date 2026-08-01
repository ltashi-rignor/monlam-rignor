from functools import lru_cache
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]

_WEAK_JWT = {
    "",
    "change-me",
    "change-me-to-a-long-random-secret",
    "dev-secret-change-in-production",
    "secret",
    "jwt-secret",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Monlam Melong (primary LLM for most agents)
    monlam_api_key: str = ""
    monlam_api_base: str = "https://api-v1.monlamai.studio"
    monlam_model: str = "melong"

    # Anthropic Claude — used for grammar check when configured
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"
    anthropic_api_url: str = "https://api.anthropic.com/v1/messages"
    # melong | claude | auto (claude if key set, else melong)
    grammar_llm_provider: str = "auto"

    database_url: str = "postgresql+asyncpg://lobsangtashi@localhost:5432/monlam_rignor"
    database_url_sync: str = "postgresql://lobsangtashi@localhost:5432/monlam_rignor"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    # Short-lived access tokens; use refresh tokens for longer sessions.
    jwt_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 14

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@monlam-rignor.local"
    smtp_from_email: str = ""
    smtp_from_name: str = ""
    smtp_use_tls: bool | None = None  # None = auto (True for 587)
    otp_expire_minutes: int = 10
    # Never enable in production — leaks codes into logs.
    otp_dev_log: bool = False

    # local | production
    app_env: str = "local"
    # Disable OpenAPI docs outside local unless explicitly enabled.
    enable_docs: bool | None = None

    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024
    embedding_local_files_only: bool = True
    embedding_preload: bool = True
    embedding_request_wait_s: float = 0.0

    grammar_pdf_path: str = str(ROOT / "classical-tibetan-grammar-handbook_compress.pdf")
    # Second grammar ground-truth PDF (scanned → Monlam OCR → embed).
    grammar_secondary_pdf_path: str = str(ROOT / "secon-grammer.pdf")
    grammar_ocr_cache_path: str = str(ROOT / "data" / "grammar_ocr")
    content_path: str = str(ROOT / "data" / "content")

    app_name: str = "Monlam Rignor"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # LLM safety caps
    llm_max_tokens_cap: int = 4096
    llm_max_user_chars: int = 8000
    llm_max_messages: int = 24

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

    @field_validator("monlam_api_key", "anthropic_api_key", mode="before")
    @classmethod
    def clean_api_key(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip().strip('"').strip("'")

    @field_validator("jwt_secret", mode="before")
    @classmethod
    def clean_jwt(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip().strip('"').strip("'")

    @model_validator(mode="after")
    def validate_security(self) -> "Settings":
        env = (self.app_env or "local").lower().strip()
        secret = self.jwt_secret or ""
        weak = secret.lower() in _WEAK_JWT or len(secret) < 32
        if env in {"production", "prod", "staging"}:
            if weak:
                raise ValueError(
                    "JWT_SECRET must be a strong random string (≥32 chars) in production. "
                    "Set APP_ENV=local only for development."
                )
            if self.otp_dev_log:
                raise ValueError("OTP_DEV_LOG must be false in production.")
            if "*" in self.cors_origin_list:
                raise ValueError("CORS_ORIGINS cannot include * when credentials are used.")
        elif weak:
            # Dev: warn via property; still allow boot so local work continues,
            # but mark insecure for health/ready surfacing.
            pass
        return self

    @property
    def jwt_is_weak(self) -> bool:
        secret = (self.jwt_secret or "").lower()
        return secret in _WEAK_JWT or len(self.jwt_secret or "") < 32

    @property
    def is_production(self) -> bool:
        return (self.app_env or "").lower().strip() in {"production", "prod", "staging"}

    @property
    def docs_enabled(self) -> bool:
        if self.enable_docs is not None:
            return bool(self.enable_docs)
        return not self.is_production

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
    def monlam_ocr_single_url(self) -> str:
        return f"{self.monlam_api_base.rstrip('/')}/api/v1/ocr/single-page"

    @property
    def monlam_ocr_multi_url(self) -> str:
        return f"{self.monlam_api_base.rstrip('/')}/api/v1/ocr/multi-page"

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
    def grammar_secondary_pdf(self) -> Path:
        return self.resolve_path(self.grammar_secondary_pdf_path)

    @property
    def grammar_ocr_cache_dir(self) -> Path:
        return self.resolve_path(self.grammar_ocr_cache_path)

    @property
    def content_dir(self) -> Path:
        return self.resolve_path(self.content_path)


@lru_cache
def get_settings() -> Settings:
    return Settings()

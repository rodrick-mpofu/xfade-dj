"""Application settings, loaded from environment / backend/.env."""

import json
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "xfade"
    version: str = "0.1.0"
    environment: str = "development"

    supabase_url: str
    supabase_anon_key: str
    # Bypasses RLS — only for the extraction job, which runs without a request context.
    supabase_service_role_key: str

    audio_bucket: str = "tracks"

    # NoDecode is load-bearing: without it pydantic-settings tries to JSON-decode
    # complex types straight from the environment and raises before any validator
    # runs, so a plain comma-separated CORS_ORIGINS kills the app at startup.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma-separated string so .env stays readable.

        NoDecode turned off the built-in JSON handling, so a JSON list — the form
        pydantic-settings documents — is parsed here too rather than silently
        becoming one long origin.
        """
        if not isinstance(value, str):
            return value

        text = value.strip()
        if text.startswith("["):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass
        return [origin.strip() for origin in text.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://plantulas:plantulas123@localhost:5432/plantulasdb"
    backend_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]
    db_echo: bool = False

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @field_validator("cors_origins", mode="before")
    def split_cors_origins(cls, value):
        # Accept comma-separated origins from env (e.g., "https://app.com,http://localhost:5173")
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()

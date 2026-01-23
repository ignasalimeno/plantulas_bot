from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://plantulas:plantulas123@localhost:5432/plantulasdb"
    backend_port: int = 8000
    # Accept both JSON list or CSV string from env to avoid parsing issues on hosts
    cors_origins: Union[List[str], str] = ["http://localhost:5173"]
    db_echo: bool = False

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @field_validator("cors_origins", mode="before")
    def split_cors_origins(cls, value):
        # Handles cases where env provides a CSV string, JSON array string, or already a list
        if value is None:
            return value
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            s = value.strip()
            # If it's a JSON-like array, try to parse safely
            if s.startswith("[") and s.endswith("]"):
                try:
                    import json
                    parsed = json.loads(s)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except Exception:
                    pass
            # Fallback: CSV splitting
            return [origin.strip() for origin in s.split(",") if origin.strip()]
        return value


settings = Settings()

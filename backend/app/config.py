from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://plantulas:plantulas123@localhost:5432/plantulasdb"
    backend_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]
    db_echo: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

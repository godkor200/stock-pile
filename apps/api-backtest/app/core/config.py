from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "stockpile"
    postgres_user: str = "stockpile"
    postgres_password: str = "stockpile"

    redis_host: str = "localhost"
    redis_port: int = 6379

    anthropic_api_key: str = ""

    backtest_port: int = 3003

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}"

    class Config:
        env_file = "../../.env"


settings = Settings()

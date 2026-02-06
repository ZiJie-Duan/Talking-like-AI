from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    OPENAI_API_KEY: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()

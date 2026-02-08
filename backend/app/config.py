from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    LLM_TEMPERATURE_CHAT: float = 0.7
    LLM_TEMPERATURE_ANNOTATION: float = 0.3
    LLM_MAX_TOKENS_CHAT: int = 1024
    LLM_MAX_TOKENS_ANNOTATION: int = 4096

    model_config = {"env_file": ".env"}


settings = Settings()

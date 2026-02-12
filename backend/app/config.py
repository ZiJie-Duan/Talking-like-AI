from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    OPENAI_API_KEY: str = ""

    # 三档模型
    MODEL_LIGHT: str = "gpt-5-nano-2025-08-07"   # 辅助模型（轻量任务）
    MODEL_MAIN: str = "gpt-5-mini-2025-08-07"    # 主力模型（日常对话）
    MODEL_STRONG: str = "gpt-5.2-2025-12-11"     # 强模型（复杂推理）

    LLM_TEMPERATURE_CHAT: float = 0.7
    LLM_TEMPERATURE_ANNOTATION: float = 0.3
    LLM_MAX_TOKENS_CHAT: int = 1024
    LLM_MAX_TOKENS_ANNOTATION: int = 4096

    model_config = {"env_file": ".env"}


settings = Settings()

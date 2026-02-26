import json
import logging
from dataclasses import dataclass, field

from app.config import settings
from app.prompts import moderation as moderation_prompt
from app.services import llm_service

logger = logging.getLogger(__name__)


@dataclass
class ModerationResult:
    passed: bool
    category: str = field(default="ok")


async def check(content: str) -> ModerationResult:
    """Classify user input. Returns ModerationResult with passed=True on any error (fail-open)."""
    messages = [
        {"role": "system", "content": moderation_prompt.SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]
    try:
        # 用 stream_chat 收集完整文本，避免 json_object response_format 兼容性问题
        full = ""
        async for token in llm_service.stream_chat(messages, model=settings.MODEL_LIGHT):
            full += token

        result = json.loads(full.strip())
        passed = bool(result.get("passed", True))
        category = result.get("category", "ok") if not passed else "ok"
        logger.info("Moderation result: passed=%s, category=%s", passed, category)
        return ModerationResult(passed=passed, category=category)
    except Exception as e:
        logger.warning("Moderation check failed (%s), defaulting to pass", e)
        return ModerationResult(passed=True)

import json
import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import settings
from app.exceptions import LLMError

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def stream_chat(messages: list[dict]) -> AsyncGenerator[str]:
    """Stream chat completion, yielding content deltas."""
    client = _get_client()
    try:
        stream = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            max_completion_tokens=settings.LLM_MAX_TOKENS_CHAT,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
    except Exception as e:
        logger.error("LLM stream error: %s", e)
        raise LLMError(detail=str(e)) from e


async def json_chat(messages: list[dict]) -> dict:
    """Non-streaming chat completion with JSON response format."""
    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            max_completion_tokens=settings.LLM_MAX_TOKENS_ANNOTATION,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s", e)
        raise LLMError(detail="LLM returned invalid JSON") from e
    except Exception as e:
        logger.error("LLM JSON chat error: %s", e)
        raise LLMError(detail=str(e)) from e

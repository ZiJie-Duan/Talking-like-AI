import json
import logging
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from beanie import PydanticObjectId

from app.exceptions import (
    InsufficientMessagesError,
    InvalidStageError,
    SessionNotFoundError,
)
from app.models.session import Annotation, Message, MoodRating, Session, SessionStage
from app.prompts import stage2, stage3, stage4
from app.prompts.builder import build_messages
from app.schemas.session import SessionOut
from app.config import settings
from app.services import llm_service

logger = logging.getLogger(__name__)


async def _get_session(session_id: str) -> Session:
    try:
        oid = PydanticObjectId(session_id)
    except Exception as e:
        raise SessionNotFoundError(session_id) from e
    session = await Session.get(oid)
    if session is None:
        raise SessionNotFoundError(session_id)
    return session


def _to_out(session: Session) -> SessionOut:
    return SessionOut(
        id=str(session.id),
        stage=session.stage,
        user_issue=session.user_issue,
        stage2_messages=[
            {"role": m.role, "content": m.content, "created_at": m.created_at}
            for m in session.stage2_messages
        ],
        stage3_messages=[
            {"role": m.role, "content": m.content, "created_at": m.created_at}
            for m in session.stage3_messages
        ],
        mood_ratings=session.mood_ratings,
        annotations=session.annotations,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


async def _touch(session: Session) -> None:
    session.updated_at = datetime.now(UTC)
    await session.save()


def _sse_event(event: str, data: dict) -> dict:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}


# ── Public API ────────────────────────────────────────────────


async def create_session() -> dict:
    session = Session()
    await session.insert()
    return {"id": str(session.id), "stage": session.stage}


async def get_session(session_id: str) -> SessionOut:
    session = await _get_session(session_id)
    return _to_out(session)


async def submit_issue(session_id: str, content: str) -> SessionOut:
    session = await _get_session(session_id)
    if session.stage != SessionStage.INPUT:
        raise InvalidStageError(session.stage.value, SessionStage.INPUT.value)

    session.user_issue = content
    session.stage = SessionStage.CONVERSATION
    await _touch(session)
    return _to_out(session)


async def stage2_chat(session_id: str, content: str) -> AsyncGenerator[dict]:
    session = await _get_session(session_id)
    if session.stage != SessionStage.CONVERSATION:
        raise InvalidStageError(session.stage.value, SessionStage.CONVERSATION.value)

    # Save user message
    user_msg = Message(role="user", content=content)
    session.stage2_messages.append(user_msg)
    await _touch(session)

    # Build prompt and stream AI response (主力模型)
    system_prompt = stage2.SYSTEM_PROMPT.format(user_issue=session.user_issue)
    messages = build_messages(system_prompt, session.stage2_messages)
    full_content = ""

    async for token in llm_service.stream_chat(messages, model=settings.MODEL_MAIN):
        full_content += token
        yield _sse_event("token", {"content": token})

    # Save AI message
    ai_msg = Message(role="ai", content=full_content)
    session.stage2_messages.append(ai_msg)
    await _touch(session)

    yield _sse_event("done", {"message_index": len(session.stage2_messages) - 1})


async def save_mood_rating(session_id: str, value: int) -> SessionOut:
    session = await _get_session(session_id)
    if session.stage != SessionStage.CONVERSATION:
        raise InvalidStageError(session.stage.value, SessionStage.CONVERSATION.value)

    rating = MoodRating(
        value=value,
        after_message_index=len(session.stage2_messages) - 1,
    )
    session.mood_ratings.append(rating)
    await _touch(session)
    return _to_out(session)


async def complete_stage2(session_id: str) -> AsyncGenerator[dict]:
    session = await _get_session(session_id)
    if session.stage != SessionStage.CONVERSATION:
        raise InvalidStageError(session.stage.value, SessionStage.CONVERSATION.value)
    if len(session.stage2_messages) < 2:
        raise InsufficientMessagesError(2)

    # Transition to ROLE_SWAP
    session.stage = SessionStage.ROLE_SWAP
    await _touch(session)

    # Generate AI opening message for stage 3 (主力模型)
    opening_prompt = stage3.OPENING_PROMPT.format(user_issue=session.user_issue)
    messages = build_messages(stage3.SYSTEM_PROMPT, [], extra_user_message=opening_prompt)
    full_content = ""

    async for token in llm_service.stream_chat(messages, model=settings.MODEL_MAIN):
        full_content += token
        yield _sse_event("token", {"content": token})

    # Save AI opening as first stage3 message
    ai_msg = Message(role="ai", content=full_content)
    session.stage3_messages.append(ai_msg)
    await _touch(session)

    yield _sse_event("done", {"message_index": 0})


async def stage3_chat(session_id: str, content: str) -> AsyncGenerator[dict]:
    session = await _get_session(session_id)
    if session.stage != SessionStage.ROLE_SWAP:
        raise InvalidStageError(session.stage.value, SessionStage.ROLE_SWAP.value)

    # Save user message
    user_msg = Message(role="user", content=content)
    session.stage3_messages.append(user_msg)
    await _touch(session)

    # Build prompt and stream AI response (主力模型)
    messages = build_messages(stage3.SYSTEM_PROMPT, session.stage3_messages)
    full_content = ""

    async for token in llm_service.stream_chat(messages, model=settings.MODEL_MAIN):
        full_content += token
        yield _sse_event("token", {"content": token})

    # Save AI message
    ai_msg = Message(role="ai", content=full_content)
    session.stage3_messages.append(ai_msg)
    await _touch(session)

    yield _sse_event("done", {"message_index": len(session.stage3_messages) - 1})


async def complete_stage3(session_id: str) -> SessionOut:
    session = await _get_session(session_id)
    if session.stage != SessionStage.ROLE_SWAP:
        raise InvalidStageError(session.stage.value, SessionStage.ROLE_SWAP.value)
    if len(session.stage3_messages) < 2:
        raise InsufficientMessagesError(2)

    # Build stage3 conversation text for annotation
    conversation_text = "\n".join(
        f"[{'倾诉者' if m.role == 'ai' else '倾听者'}]: {m.content}"
        for m in session.stage3_messages
    )
    messages = build_messages(
        stage4.SYSTEM_PROMPT,
        [],
        extra_user_message=f"以下是对话内容：\n\n{conversation_text}",
    )

    result = await llm_service.json_chat(messages, model=settings.MODEL_STRONG)

    # Parse annotations
    raw_annotations = result.get("annotations", [])
    session.annotations = [
        Annotation(message_index=a["message_index"], content=a["content"])
        for a in raw_annotations
    ]
    session.stage = SessionStage.REVIEW
    await _touch(session)
    return _to_out(session)

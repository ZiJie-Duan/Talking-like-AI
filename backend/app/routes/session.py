from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.exceptions import AppError
from app.schemas.session import ChatRequest, IssueSubmit, MoodRatingRequest
from app.services import session_service

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


async def _wrap_sse(generator):
    """Wrap an async generator to catch errors and emit SSE error events."""
    try:
        async for event in generator:
            yield event
    except AppError as e:
        yield session_service._sse_event("error", {"detail": e.detail})
    except Exception as e:
        yield session_service._sse_event("error", {"detail": str(e)})


@router.post("/")
async def create_session():
    return await session_service.create_session()


@router.get("/{session_id}")
async def get_session(session_id: str):
    return await session_service.get_session(session_id)


@router.post("/{session_id}/issue")
async def submit_issue(session_id: str, body: IssueSubmit):
    return await session_service.submit_issue(session_id, body.content)


@router.post("/{session_id}/stage2/chat")
async def stage2_chat(session_id: str, body: ChatRequest):
    return EventSourceResponse(_wrap_sse(session_service.stage2_chat(session_id, body.content)))


@router.post("/{session_id}/stage2/mood")
async def save_mood_rating(session_id: str, body: MoodRatingRequest):
    return await session_service.save_mood_rating(session_id, body.value)


@router.post("/{session_id}/stage2/complete")
async def complete_stage2(session_id: str):
    return EventSourceResponse(_wrap_sse(session_service.complete_stage2(session_id)))


@router.post("/{session_id}/stage3/chat")
async def stage3_chat(session_id: str, body: ChatRequest):
    return EventSourceResponse(_wrap_sse(session_service.stage3_chat(session_id, body.content)))


@router.post("/{session_id}/stage3/complete")
async def complete_stage3(session_id: str):
    return await session_service.complete_stage3(session_id)

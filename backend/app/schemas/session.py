from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.session import Annotation, Message, MoodRating, SessionStage


class SessionCreate(BaseModel):
    pass


class SessionCreated(BaseModel):
    id: str
    stage: SessionStage


class IssueSubmit(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class MoodRatingRequest(BaseModel):
    value: int = Field(ge=0, le=100)


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: datetime


class SessionOut(BaseModel):
    id: str
    stage: SessionStage
    user_issue: Optional[str] = None
    stage2_messages: list[MessageOut] = []
    stage3_messages: list[MessageOut] = []
    mood_ratings: list[MoodRating] = []
    annotations: list[Annotation] = []
    created_at: datetime
    updated_at: datetime

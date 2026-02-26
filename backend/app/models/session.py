from datetime import UTC, datetime
from enum import Enum
from typing import Optional

from beanie import Document
from pydantic import BaseModel, Field


class SessionStage(str, Enum):
    INPUT = "input"
    CONVERSATION = "conversation"
    ROLE_SWAP = "roleSwap"
    REVIEW = "review"
    TERMINATED = "terminated"


class Message(BaseModel):
    role: str  # "user" | "ai"
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class MoodRating(BaseModel):
    value: int = Field(ge=0, le=100)
    after_message_index: int


class Annotation(BaseModel):
    message_index: int
    content: str


class Session(Document):
    stage: SessionStage = SessionStage.INPUT
    user_issue: Optional[str] = None
    stage2_messages: list[Message] = Field(default_factory=list)
    stage3_messages: list[Message] = Field(default_factory=list)
    mood_ratings: list[MoodRating] = Field(default_factory=list)
    annotations: list[Annotation] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "sessions"

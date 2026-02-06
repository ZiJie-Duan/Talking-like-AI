from datetime import datetime

from beanie import Document
from pydantic import BaseModel


class Message(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = datetime.now()


class Conversation(Document):
    title: str = ""
    messages: list[Message] = []
    created_at: datetime = datetime.now()

    class Settings:
        name = "conversations"

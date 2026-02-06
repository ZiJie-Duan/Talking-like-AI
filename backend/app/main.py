from beanie import init_beanie
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.conversation import Conversation
from app.routes.chat import router as chat_router

app = FastAPI(title="Talking like AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)


@app.on_event("startup")
async def on_startup():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await init_beanie(database=client.talking_like_ai, document_models=[Conversation])

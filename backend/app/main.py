from contextlib import asynccontextmanager

from beanie import init_beanie
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.error_handlers import register_error_handlers
from app.models import document_models
from app.routes.health import router as health_router
from app.routes.session import router as session_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await init_beanie(database=client.talking_like_ai, document_models=document_models)
    yield
    client.close()


app = FastAPI(title="Talking like AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(health_router)
app.include_router(session_router)

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from openai import APIError as OpenAIAPIError

from app.exceptions import AppError, LLMError

logger = logging.getLogger(__name__)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(OpenAIAPIError)
    async def openai_error_handler(_request: Request, exc: OpenAIAPIError) -> JSONResponse:
        logger.error("OpenAI API error: %s", exc)
        wrapped = LLMError(detail=f"OpenAI error: {exc.message}")
        return JSONResponse(
            status_code=wrapped.status_code,
            content={"detail": wrapped.detail},
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

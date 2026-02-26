class AppError(Exception):
    status_code: int = 400

    def __init__(self, detail: str = "Bad request"):
        self.detail = detail
        super().__init__(detail)


class SessionNotFoundError(AppError):
    status_code: int = 404

    def __init__(self, session_id: str | None = None):
        detail = f"Session {session_id} not found" if session_id else "Session not found"
        super().__init__(detail)


class InvalidStageError(AppError):
    status_code: int = 409

    def __init__(self, current: str, expected: str):
        super().__init__(f"Invalid stage transition: current={current}, expected={expected}")


class InsufficientMessagesError(AppError):
    status_code: int = 422

    def __init__(self, required: int = 1):
        super().__init__(f"At least {required} message(s) required before this action")


class LLMError(AppError):
    status_code: int = 502

    def __init__(self, detail: str = "LLM service error"):
        super().__init__(detail)


class ModerationError(AppError):
    status_code: int = 451

    def __init__(self):
        super().__init__("对话因违反使用规范而终止")

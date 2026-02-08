from app.models.session import Message


def build_messages(
    system_prompt: str,
    history: list[Message],
    extra_user_message: str | None = None,
) -> list[dict]:
    """Convert internal Message list to OpenAI messages format.

    Internal role "ai" is mapped to OpenAI "assistant".
    """
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    for msg in history:
        role = "assistant" if msg.role == "ai" else "user"
        messages.append({"role": role, "content": msg.content})

    if extra_user_message:
        messages.append({"role": "user", "content": extra_user_message})

    return messages

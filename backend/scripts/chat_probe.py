"""
Read-only probe for the chat service.

Builds the same context/tool loop as ``run_chat`` but never persists
``ChatMessage`` rows. Used to reproduce and verify the "current environment"
fix without touching production data.

Usage (from the ``backend`` directory, with the venv active):

    python -m scripts.chat_probe 12345678 "¿Qué temperatura hay en la Carpa?"

With no question it runs a small default battery.
"""
import json
import sys

from app.database import SessionLocal
from app.models import User
from app.services import chat_service

DEFAULT_QUESTIONS = [
    "¿Qué temperatura hay en la Carpa?",
    "¿Y la humedad?",
    "¿Cómo está el EC?",
]


def _get_user(db, telegram_user_id: int) -> User:
    user = db.query(User).filter(User.telegram_user_id == telegram_user_id).first()
    if not user:
        raise SystemExit(f"No existe el usuario telegram_user_id={telegram_user_id}")
    return user


def ask(db, user: User, question: str, max_iters: int = 6) -> str:
    """Run the read-only tool loop without persisting anything."""
    messages = [
        {
            "role": "system",
            "content": chat_service.SYSTEM_PROMPT.format(
                context=chat_service._build_context(db, user)
            ),
        },
        {"role": "user", "content": question},
    ]
    client = chat_service._client()

    for _ in range(max_iters):
        response = client.chat.completions.create(
            model=chat_service.settings.ai_model,
            messages=messages,
            tools=chat_service.TOOLS,
            tool_choice="auto",
        )
        msg = response.choices[0].message

        if not msg.tool_calls:
            return msg.content or ""

        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ],
            }
        )

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            if name in chat_service.READ_TOOLS:
                result = chat_service._execute_read(db, user, name, args)
            else:
                result = {
                    "status": "pending_confirmation",
                    "note": "El sistema le pedirá confirmación al usuario antes de ejecutar.",
                    "tool": name,
                }

            print(f"[tool] {name} {json.dumps(args, ensure_ascii=False)}", file=sys.stderr)

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                }
            )

    return "(sin respuesta final)"


def main() -> None:
    telegram_user_id = int(sys.argv[1]) if len(sys.argv) > 1 else 12345678
    questions = sys.argv[2:] or DEFAULT_QUESTIONS

    db = SessionLocal()
    try:
        user = _get_user(db, telegram_user_id)

        print("=" * 70)
        print("CONTEXTO ENVIADO AL MODELO")
        print("=" * 70)
        print(chat_service._build_context(db, user))

        for question in questions:
            print("=" * 70)
            print(f"USER: {question}")
            print("-" * 70)
            print(f"ASSISTANT: {ask(db, user, question)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

"""
AI chat service: builds user context, runs OpenAI tool calling, and handles
confirmation of mutating actions.
"""
import json
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    User,
    Indoor,
    Plant,
    StageTarget,
    Measurement,
    Task,
    Fertilizer,
    FertilizerApplication,
    ChatMessage,
)
from app.stages import stage_label
from app.services.indoor_service import register_indoor_watering

READ_TOOLS = {"get_indoor_status", "list_tasks", "list_fertilizers"}
MUTATION_TOOLS = {"water_indoor", "add_measurement", "apply_fertilizer", "complete_task", "set_humidifier"}

MAX_ITERATIONS = 6
HISTORY_LIMIT = 20


def _tool(name: str, description: str, properties: dict, required: list | None = None) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                **({"required": required} if required else {}),
            },
        },
    }


TOOLS = [
    _tool(
        "get_indoor_status",
        "Devuelve el estado de un indoor: etapa, objetivos, próximos riegos, última medición y tareas pendientes.",
        {
            "indoor_id": {"type": "string", "description": "ID del indoor (opcional)"},
            "indoor_name": {"type": "string", "description": "Nombre del indoor (opcional)"},
        },
    ),
    _tool(
        "list_tasks",
        "Lista las tareas del checklist de un indoor.",
        {"indoor_id": {"type": "string", "description": "ID del indoor (opcional)"}},
    ),
    _tool(
        "list_fertilizers",
        "Lista el catálogo de fertilizantes del usuario.",
        {},
    ),
    _tool(
        "water_indoor",
        "Registra un riego para todas las plantas del indoor (requiere confirmación del usuario).",
        {
            "indoor_id": {"type": "string", "description": "ID del indoor (opcional)"},
            "liters": {"type": "number", "description": "Litros por planta"},
            "ec": {"type": "number"},
            "ph": {"type": "number"},
            "runoff_ec": {"type": "number"},
            "note": {"type": "string"},
            "fertilizers": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "fertilizer_id": {"type": "string"},
                        "amount": {"type": "number", "description": "Dosis en ml/L"},
                    },
                    "required": ["fertilizer_id"],
                },
            },
        },
        ["liters"],
    ),
    _tool(
        "add_measurement",
        "Registra una medición de ambiente del indoor (requiere confirmación).",
        {
            "indoor_id": {"type": "string"},
            "temp_c": {"type": "number"},
            "humidity": {"type": "number"},
            "ph": {"type": "number"},
            "ec": {"type": "number"},
            "ppfd": {"type": "integer"},
            "runoff_ec": {"type": "number"},
            "note": {"type": "string"},
        },
    ),
    _tool(
        "apply_fertilizer",
        "Marca un fertilizante como aplicado en un indoor (requiere confirmación).",
        {
            "indoor_id": {"type": "string"},
            "fertilizer_id": {"type": "string"},
            "amount": {"type": "number", "description": "Dosis en ml/L"},
            "note": {"type": "string"},
        },
        ["fertilizer_id"],
    ),
    _tool(
        "complete_task",
        "Marca (o desmarca) una tarea del checklist como hecha (requiere confirmación).",
        {
            "task_id": {"type": "string"},
            "is_done": {"type": "boolean", "description": "true para marcar hecha (default true)"},
        },
        ["task_id"],
    ),
    _tool(
        "set_humidifier",
        "Prende o apaga el humidificador del indoor (requiere confirmación).",
        {
            "indoor_id": {"type": "string"},
            "on": {"type": "boolean", "description": "true para prender, false para apagar"},
        },
        ["on"],
    ),
]


def is_configured() -> bool:
    return bool(settings.openai_api_key)


def _num(value) -> float | None:
    return float(value) if value is not None else None


def _resolve_indoor(db: Session, user: User, indoor_id: str | None, indoor_name: str | None = None) -> Indoor | None:
    if indoor_id:
        try:
            uid = UUID(indoor_id)
            indoor = db.query(Indoor).filter(Indoor.id == uid, Indoor.user_id == user.id).first()
            if indoor:
                return indoor
        except ValueError:
            pass
    if indoor_name:
        indoor = (
            db.query(Indoor)
            .filter(Indoor.user_id == user.id, Indoor.name.ilike(f"%{indoor_name}%"))
            .first()
        )
        if indoor:
            return indoor
    # Fallback: only indoor
    indoors = db.query(Indoor).filter(Indoor.user_id == user.id).all()
    return indoors[0] if len(indoors) == 1 else None


def _indoor_status(db: Session, indoor: Indoor) -> dict:
    target = (
        db.query(StageTarget)
        .filter(StageTarget.indoor_id == indoor.id, StageTarget.stage == indoor.stage)
        .first()
    )
    plants = db.query(Plant).filter(Plant.indoor_id == indoor.id).all()
    next_water = min([p.next_water_at for p in plants if p.next_water_at], default=None)
    latest = (
        db.query(Measurement)
        .filter(Measurement.indoor_id == indoor.id)
        .order_by(Measurement.event_ts.desc())
        .first()
    )
    pending_tasks = (
        db.query(Task)
        .filter(Task.indoor_id == indoor.id, Task.is_done.is_(False))
        .all()
    )
    return {
        "indoor_id": str(indoor.id),
        "name": indoor.name,
        "stage": stage_label(indoor.stage),
        "stage_started_at": str(indoor.stage_started_at) if indoor.stage_started_at else None,
        "plants": len(plants),
        "next_water_at": str(next_water) if next_water else None,
        "humidifier": bool(indoor.humidifier),
        "humidifier_thresholds": {
            "on_below_humidity": _num(indoor.humidifier_on_below_humidity),
            "off_above_humidity": _num(indoor.humidifier_off_above_humidity),
            "on_above_temp": _num(indoor.humidifier_on_above_temp),
            "off_below_temp": _num(indoor.humidifier_off_below_temp),
        },
        "targets": {
            "ec": [_num(target.ec_min), _num(target.ec_max)],
            "ph": [_num(target.ph_min), _num(target.ph_max)],
            "temp": [_num(target.temp_min), _num(target.temp_max)],
            "humidity": [_num(target.humidity_min), _num(target.humidity_max)],
            "light_height": [_num(target.light_height_min), _num(target.light_height_max)],
            "ppfd": [target.ppfd_min, target.ppfd_max],
            "light_schedule": target.light_schedule,
        }
        if target
        else None,
        "latest_measurement": {
            "at": latest.event_ts.isoformat() if latest else None,
            "temp_c": _num(latest.temp_c) if latest else None,
            "humidity": _num(latest.humidity) if latest else None,
            "ph": _num(latest.ph) if latest else None,
            "ec": _num(latest.ec) if latest else None,
            "ppfd": latest.ppfd if latest else None,
        }
        if latest
        else None,
        "pending_tasks": [{"id": str(t.id), "title": t.title} for t in pending_tasks],
    }


def _execute_read(db: Session, user: User, name: str, args: dict) -> dict:
    if name == "get_indoor_status":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        return _indoor_status(db, indoor)

    if name == "list_tasks":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        tasks = db.query(Task).filter(Task.indoor_id == indoor.id).all()
        return {
            "indoor": indoor.name,
            "tasks": [
                {"id": str(t.id), "title": t.title, "frequency": t.frequency, "is_done": t.is_done}
                for t in tasks
            ],
        }

    if name == "list_fertilizers":
        ferts = db.query(Fertilizer).filter(Fertilizer.user_id == user.id).all()
        return {
            "fertilizers": [
                {
                    "id": str(f.id),
                    "name": f.name,
                    "kind": f.kind,
                    "default_amount": _num(f.default_amount),
                }
                for f in ferts
            ]
        }

    return {"error": f"Tool desconocida: {name}"}


def _execute_mutation(db: Session, user: User, name: str, args: dict) -> dict:
    if name == "water_indoor":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        liters = float(args.get("liters") or 0)
        if liters <= 0:
            return {"error": "Litros inválidos"}
        event_date = date.today()
        plants, names, _group_id = register_indoor_watering(
            db,
            indoor,
            liters=liters,
            event_date=event_date,
            note=args.get("note"),
            ec=args.get("ec"),
            ph=args.get("ph"),
            runoff_ec=args.get("runoff_ec"),
        )
        applied = 0
        for f in args.get("fertilizers") or []:
            fert = _resolve_fertilizer(db, user, f.get("fertilizer_id"))
            if not fert:
                continue
            db.add(FertilizerApplication(
                indoor_id=indoor.id,
                fertilizer_id=fert.id,
                applied_at=datetime.now(),
                amount=Decimal(str(f["amount"])) if f.get("amount") is not None else None,
                note=args.get("note"),
            ))
            applied += 1
        db.commit()
        return {
            "ok": True,
            "summary": f"Riego de {liters} L a {len(plants)} planta(s) en {indoor.name}."
            + (f" {applied} fertilizante(s) aplicado(s)." if applied else ""),
            "plants": names,
        }

    if name == "add_measurement":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        m = Measurement(
            indoor_id=indoor.id,
            event_ts=datetime.now(),
            temp_c=Decimal(str(args["temp_c"])) if args.get("temp_c") is not None else None,
            humidity=Decimal(str(args["humidity"])) if args.get("humidity") is not None else None,
            ph=Decimal(str(args["ph"])) if args.get("ph") is not None else None,
            ec=Decimal(str(args["ec"])) if args.get("ec") is not None else None,
            runoff_ec=Decimal(str(args["runoff_ec"])) if args.get("runoff_ec") is not None else None,
            ppfd=args.get("ppfd"),
            note=args.get("note"),
        )
        db.add(m)
        db.commit()
        return {"ok": True, "summary": f"Medición registrada en {indoor.name}."}

    if name == "apply_fertilizer":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        fert = _resolve_fertilizer(db, user, args.get("fertilizer_id"))
        if not fert:
            return {"error": "Fertilizante no encontrado"}
        amount = args.get("amount")
        if amount is None and fert.default_amount is not None:
            amount = float(fert.default_amount)
        db.add(FertilizerApplication(
            indoor_id=indoor.id,
            fertilizer_id=fert.id,
            applied_at=datetime.now(),
            amount=Decimal(str(amount)) if amount is not None else None,
            note=args.get("note"),
        ))
        db.commit()
        return {
            "ok": True,
            "summary": f"Fertilizante '{fert.name}' aplicado en {indoor.name}"
            + (f" ({amount} ml/L)." if amount is not None else "."),
        }

    if name == "complete_task":
        try:
            tid = UUID(args["task_id"])
        except (ValueError, KeyError):
            return {"error": "task_id inválido"}
        task = (
            db.query(Task)
            .join(Indoor)
            .filter(Task.id == tid, Indoor.user_id == user.id)
            .first()
        )
        if not task:
            return {"error": "Tarea no encontrada"}
        is_done = args.get("is_done", True)
        task.is_done = bool(is_done)
        task.completed_at = datetime.now() if is_done else None
        db.commit()
        return {
            "ok": True,
            "summary": f"Tarea '{task.title}' {'marcada como hecha' if is_done else 'desmarcada'}.",
        }

    if name == "set_humidifier":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        indoor.humidifier = bool(args.get("on"))
        db.commit()
        return {
            "ok": True,
            "summary": f"Humidificador {'encendido' if indoor.humidifier else 'apagado'} en {indoor.name}.",
        }

    return {"error": f"Acción desconocida: {name}"}


def _resolve_fertilizer(db: Session, user: User, fertilizer_id) -> Fertilizer | None:
    if not fertilizer_id:
        return None
    try:
        fid = UUID(str(fertilizer_id))
    except ValueError:
        return None
    return (
        db.query(Fertilizer)
        .filter(Fertilizer.id == fid, Fertilizer.user_id == user.id)
        .first()
    )


def _build_context(db: Session, user: User) -> str:
    indoors = db.query(Indoor).filter(Indoor.user_id == user.id).all()
    lines = ["INDOORS DEL USUARIO:"]
    if not indoors:
        lines.append("- (no tiene indoors)")
    for ind in indoors:
        status = _indoor_status(db, ind)
        lines.append(
            f"- {ind.name} (id={ind.id}) | etapa={status['stage']} | "
            f"plantas={status['plants']} | próximo riego={status['next_water_at']} | "
            f"humidificador={'ON' if status['humidifier'] else 'OFF'}"
        )
        if status["targets"]:
            t = status["targets"]
            lines.append(
                f"  objetivos: EC {t['ec'][0]}-{t['ec'][1]}, pH {t['ph'][0]}-{t['ph'][1]}, "
                f"temp {t['temp'][0]}-{t['temp'][1]}°C, HR {t['humidity'][0]}-{t['humidity'][1]}%, "
                f"luz {t['light_height'][0]}-{t['light_height'][1]}cm, PPFD {t['ppfd'][0]}-{t['ppfd'][1]}, "
                f"horario {t['light_schedule']}"
            )
        if status["latest_measurement"]:
            m = status["latest_measurement"]
            lines.append(
                f"  última medición ({m['at']}): temp={m['temp_c']}, HR={m['humidity']}, "
                f"EC={m['ec']}, pH={m['ph']}, PPFD={m['ppfd']}"
            )
        if status["pending_tasks"]:
            tasks = ", ".join(f"{t['title']} (id={t['id']})" for t in status["pending_tasks"])
            lines.append(f"  tareas pendientes: {tasks}")

    ferts = db.query(Fertilizer).filter(Fertilizer.user_id == user.id).all()
    lines.append("")
    lines.append("FERTILIZANTES (catálogo):")
    if ferts:
        for f in ferts:
            lines.append(f"- {f.name} (id={f.id}, tipo={f.kind}, dosis default={_num(f.default_amount)} ml/L)")
    else:
        lines.append("- (catálogo vacío)")

    return "\n".join(lines)


SYSTEM_PROMPT = """Sos el asistente de PlantulasBot, un experto en cultivo de cannabis en interior (fibra de coco, SCROG, fertirriego).
Respondés SIEMPRE en español, de forma clara, breve y concreta.

{context}

REGLAS:
- Para consultar datos usá las tools de lectura.
- Para acciones que MODIFICAN datos (regar, registrar medición, aplicar fertilizante, completar tarea) llamá a la tool correspondiente; el sistema le pedirá confirmación al usuario antes de ejecutar. Nunca digas que ya se ejecutó algo que está pendiente de confirmación.
- No inventes datos: si falta un id o un valor, pedíselo al usuario.
- Fechas en formato YYYY-MM-DD.
- Si el usuario menciona un indoor por nombre, usá el id que figura en el contexto.
- Podés dar consejos de cultivo (EC, pH, PPFD, temperatura, humedad) basados en los objetivos de la etapa."""


def _client():
    from openai import OpenAI

    return OpenAI(api_key=settings.openai_api_key)


def _history(db: Session, user: User) -> list[dict]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.role.in_(["user", "assistant"]))
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_LIMIT)
        .all()
    )
    rows = list(reversed(rows))
    return [{"role": r.role, "content": r.content} for r in rows]


def _clear_pending(db: Session, user: User) -> None:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.pending_action.isnot(None))
        .all()
    )
    for r in rows:
        r.pending_action = None
    if rows:
        db.commit()


def run_chat(db: Session, user: User, message: str) -> dict:
    """Process a user message and return {reply, pending_action}."""
    _clear_pending(db, user)

    user_msg = ChatMessage(user_id=user.id, role="user", content=message)
    db.add(user_msg)
    db.commit()

    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(context=_build_context(db, user))}]
    messages.extend(_history(db, user))

    client = _client()
    pending: dict | None = None

    for _ in range(MAX_ITERATIONS):
        response = client.chat.completions.create(
            model=settings.ai_model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        msg = response.choices[0].message

        if not msg.tool_calls:
            reply = msg.content or ""
            db.add(ChatMessage(user_id=user.id, role="assistant", content=reply))
            db.commit()
            return {"reply": reply, "pending_action": None}

        # Register the assistant tool-call turn
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in msg.tool_calls
            ],
        })

        pending_actions = []
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            if name in READ_TOOLS:
                result = _execute_read(db, user, name, args)
            elif name in MUTATION_TOOLS:
                pending_actions.append({"tool": name, "arguments": args})
                result = {
                    "status": "pending_confirmation",
                    "note": "El sistema le pedirá confirmación al usuario antes de ejecutar.",
                }
            else:
                result = {"error": f"Tool desconocida: {name}"}

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })

        if pending_actions:
            followup = client.chat.completions.create(
                model=settings.ai_model,
                messages=messages,
            )
            reply = followup.choices[0].message.content or "¿Confirmás la acción?"
            pending = {"actions": pending_actions}
            db.add(ChatMessage(
                user_id=user.id,
                role="assistant",
                content=reply,
                pending_action=pending,
            ))
            db.commit()
            return {"reply": reply, "pending_action": pending}

    fallback = "No pude completar la respuesta. Probá reformular."
    db.add(ChatMessage(user_id=user.id, role="assistant", content=fallback))
    db.commit()
    return {"reply": fallback, "pending_action": None}


def confirm_pending(db: Session, user: User, approve: bool) -> dict:
    """Execute or discard the pending action(s)."""
    row = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.pending_action.isnot(None))
        .order_by(ChatMessage.created_at.desc())
        .first()
    )
    if not row:
        return {"reply": "No hay ninguna acción pendiente."}

    actions = (row.pending_action or {}).get("actions", [])
    row.pending_action = None
    db.commit()

    if not approve:
        reply = "Listo, cancelé la acción."
        db.add(ChatMessage(user_id=user.id, role="assistant", content=reply))
        db.commit()
        return {"reply": reply}

    summaries = []
    for action in actions:
        result = _execute_mutation(db, user, action.get("tool"), action.get("arguments") or {})
        summaries.append(result.get("summary") or result.get("error") or "Hecho.")

    reply = " ".join(summaries) if summaries else "Hecho."
    db.add(ChatMessage(user_id=user.id, role="assistant", content=reply))
    db.commit()
    return {"reply": reply}

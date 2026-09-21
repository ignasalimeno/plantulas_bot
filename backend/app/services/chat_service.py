"""
AI chat service: builds user context, runs OpenAI tool calling, and handles
confirmation of mutating actions.
"""
import json
from datetime import datetime, date, timedelta
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
    IndoorHistory,
    WateringHistory,
    ChatMessage,
)
from app.stages import stage_label, STAGE_KEYS
from app.services.indoor_service import register_indoor_watering, update_indoor
from app.timeutils import now

READ_TOOLS = {
    "get_indoor_status",
    "list_tasks",
    "list_fertilizers",
    "get_measurements_summary",
    "get_watering_history",
    "get_fertilizer_applications",
    "get_indoor_history",
    "get_plants",
    "analyze_indoor",
}
MUTATION_TOOLS = {
    "water_indoor",
    "add_measurement",
    "apply_fertilizer",
    "complete_task",
    "set_humidifier",
    "set_stage",
    "set_light",
    "set_climate",
    "create_task",
}

MAX_ITERATIONS = 8
HISTORY_LIMIT = 20
HISTORY_RECENT = 6
HISTORY_SNIPPET = 160
ANALYSIS_MAX_TOKENS = 900


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
        "Devuelve el estado de un indoor: etapa, objetivos, próximos riegos, ambiente actual (temperatura, humedad, EC, pH, runoff, PPFD y luz) y tareas pendientes.",
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
            "plant_names": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Nombres de plantas a regar (opcional; si no se pasa, riega todas).",
            },
            "plant_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "IDs de plantas a regar (opcional; alternativa a plant_names).",
            },
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
    _tool(
        "get_measurements_summary",
        "Resumen estadístico de las mediciones de ambiente de un indoor en los últimos N días: promedio, mín, máx, último valor y tendencia por variable.",
        {
            "indoor_id": {"type": "string"},
            "days": {"type": "integer", "description": "Ventana en días (default 14)"},
        },
    ),
    _tool(
        "get_watering_history",
        "Historial de riegos de un indoor agrupado por evento (litros, EC, pH, runoff y plantas regadas).",
        {
            "indoor_id": {"type": "string"},
            "days": {"type": "integer", "description": "Ventana en días (default 30)"},
        },
    ),
    _tool(
        "get_fertilizer_applications",
        "Historial de aplicaciones de fertilizantes de un indoor (producto, dosis y fecha).",
        {
            "indoor_id": {"type": "string"},
            "days": {"type": "integer", "description": "Ventana en días (default 30)"},
        },
    ),
    _tool(
        "get_indoor_history",
        "Eventos del historial de un indoor (cambios de etapa, ajustes de luz, notas).",
        {
            "indoor_id": {"type": "string"},
            "limit": {"type": "integer", "description": "Máximo de eventos (default 20)"},
        },
    ),
    _tool(
        "get_plants",
        "Lista las plantas de un indoor con último riego, próximo riego e intervalo.",
        {"indoor_id": {"type": "string"}},
    ),
    _tool(
        "analyze_indoor",
        "Analiza en profundidad el estado e historial de un indoor con un modelo avanzado y devuelve diagnóstico y recomendaciones concretas.",
        {
            "indoor_id": {"type": "string"},
            "focus": {
                "type": "string",
                "description": "Enfoque del análisis (ej: 'plan de fertirriego', 'clima', 'general')",
            },
            "days": {"type": "integer", "description": "Ventana en días (default 14)"},
        },
    ),
    _tool(
        "set_stage",
        "Cambia la etapa de cultivo de un indoor (requiere confirmación).",
        {
            "indoor_id": {"type": "string"},
            "stage": {
                "type": "string",
                "description": "seedling | veg_early | veg_late | flower_early | flower_mid | flower_late | flush",
            },
        },
        ["stage"],
    ),
    _tool(
        "set_light",
        "Ajusta la luz de un indoor: altura (cm), potencia (%) y/u horario (requiere confirmación).",
        {
            "indoor_id": {"type": "string"},
            "light_height_cm": {"type": "number"},
            "light_power_pct": {"type": "integer", "description": "0-100"},
            "light_schedule": {"type": "string", "description": "Ej: 18/6, 12/12"},
        },
    ),
    _tool(
        "set_climate",
        "Ajusta el clima de un indoor: modo y umbrales del humidificador, y modo/umbrales del aire acondicionado (requiere confirmación).",
        {
            "indoor_id": {"type": "string"},
            "humidifier_mode": {"type": "string", "description": "auto | manual | off"},
            "humidifier_on_below_humidity": {"type": "number"},
            "humidifier_off_above_humidity": {"type": "number"},
            "humidifier_on_above_temp": {"type": "number"},
            "humidifier_off_below_temp": {"type": "number"},
            "ac_mode": {"type": "string", "description": "auto | manual | off"},
            "ac": {"type": "boolean", "description": "Prender/apagar AC (modo manual)"},
            "ac_hvac_mode": {"type": "string", "description": "cool | heat | fan | dry"},
            "ac_on_above_temp": {"type": "number"},
            "ac_off_below_temp": {"type": "number"},
        },
    ),
    _tool(
        "create_task",
        "Crea una tarea en el checklist de un indoor (requiere confirmación).",
        {
            "indoor_id": {"type": "string"},
            "title": {"type": "string"},
            "frequency": {"type": "string", "description": "daily | weekly | every_2_3_days"},
            "stage": {"type": "string"},
            "due_at": {"type": "string", "description": "YYYY-MM-DD"},
        },
        ["title"],
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


def _current_env(db: Session, indoor: Indoor) -> dict:
    """Best-known current environment for an indoor.

    For every measurement field we take the most recent Measurement that
    actually has a value (so a PPFD-only reading does not mask an older
    temperature). Temperature and humidity fall back to the values stored
    on the indoor (the ones edited from the Ambiente panel).
    """

    def latest(field: str) -> Measurement | None:
        column = getattr(Measurement, field)
        return (
            db.query(Measurement)
            .filter(Measurement.indoor_id == indoor.id, column.isnot(None))
            .order_by(Measurement.event_ts.desc())
            .first()
        )

    temp_row = latest("temp_c")
    humidity_row = latest("humidity")
    ec_row = latest("ec")
    ph_row = latest("ph")
    runoff_row = latest("runoff_ec")
    ppfd_row = latest("ppfd")

    temp_c = temp_row.temp_c if temp_row else None
    if temp_c is None:
        temp_c = indoor.temp_c
    humidity = humidity_row.humidity if humidity_row else None
    if humidity is None:
        humidity = indoor.humidity

    return {
        "temp_c": _num(temp_c),
        "humidity": _num(humidity),
        "ec": _num(ec_row.ec) if ec_row else None,
        "ph": _num(ph_row.ph) if ph_row else None,
        "runoff_ec": _num(runoff_row.runoff_ec) if runoff_row else None,
        "ppfd": ppfd_row.ppfd if ppfd_row else None,
        "light_height_cm": _num(indoor.light_height_cm),
        "light_power_pct": indoor.light_power_pct,
        "light_schedule": indoor.light_schedule,
    }


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
        "current_environment": _current_env(db, indoor),
        "latest_measurement_at": latest.event_ts.isoformat() if latest else None,
        "pending_tasks": [{"id": str(t.id), "title": t.title} for t in pending_tasks],
    }


def _series_stats(rows: list, field: str, digits: int = 2) -> dict | None:
    """Compute count/avg/min/max/last/delta/trend for a field over time-ascending rows."""
    values = [float(getattr(r, field)) for r in rows if getattr(r, field) is not None]
    if not values:
        return None
    first, last = values[0], values[-1]
    delta = last - first
    epsilon = 10 ** (-digits) if digits > 0 else 0.5
    if abs(delta) < epsilon:
        trend = "estable"
    elif delta > 0:
        trend = "sube"
    else:
        trend = "baja"
    return {
        "n": len(values),
        "avg": round(sum(values) / len(values), digits),
        "min": round(min(values), digits),
        "max": round(max(values), digits),
        "first": round(first, digits),
        "last": round(last, digits),
        "delta": round(delta, digits),
        "trend": trend,
    }


def _measurements_summary(db: Session, indoor_id, days: int) -> dict:
    since = now() - timedelta(days=days)
    rows = (
        db.query(Measurement)
        .filter(Measurement.indoor_id == indoor_id, Measurement.event_ts >= since)
        .order_by(Measurement.event_ts.asc())
        .all()
    )
    fields = {"temp_c": 1, "humidity": 1, "ec": 2, "ph": 2, "runoff_ec": 2, "ppfd": 0}
    stats = {}
    for field, digits in fields.items():
        value = _series_stats(rows, field, digits)
        if value is not None:
            stats[field] = value
    return {
        "days": days,
        "measurements_count": len(rows),
        "from": rows[0].event_ts.isoformat() if rows else None,
        "to": rows[-1].event_ts.isoformat() if rows else None,
        "stats": stats,
    }


def _watering_history(db: Session, indoor_id, days: int, limit: int = 50) -> list[dict]:
    since = now() - timedelta(days=days)
    rows = (
        db.query(WateringHistory, Plant)
        .join(Plant, WateringHistory.plant_id == Plant.id)
        .filter(Plant.indoor_id == indoor_id, WateringHistory.event_ts >= since)
        .order_by(WateringHistory.event_ts.desc())
        .all()
    )
    groups: dict = {}
    order: list = []
    for wh, plant in rows:
        gid = str(wh.group_id)
        if gid not in groups:
            groups[gid] = {
                "at": wh.event_ts.isoformat(),
                "liters": float(wh.liters),
                "ec": _num(wh.ec),
                "ph": _num(wh.ph),
                "runoff_ec": _num(wh.runoff_ec),
                "note": wh.note,
                "plants": [],
            }
            order.append(gid)
        groups[gid]["plants"].append(plant.name)
    return [groups[g] for g in order][:limit]


def _fertilizer_applications(db: Session, indoor_id, days: int, limit: int = 50) -> list[dict]:
    since = now() - timedelta(days=days)
    rows = (
        db.query(FertilizerApplication, Fertilizer)
        .join(Fertilizer, FertilizerApplication.fertilizer_id == Fertilizer.id)
        .filter(
            FertilizerApplication.indoor_id == indoor_id,
            FertilizerApplication.applied_at >= since,
        )
        .order_by(FertilizerApplication.applied_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "at": app.applied_at.isoformat(),
            "fertilizer": fert.name,
            "amount": _num(app.amount),
            "note": app.note,
        }
        for app, fert in rows
    ]


def _indoor_history(db: Session, indoor_id, limit: int = 20) -> list[dict]:
    rows = (
        db.query(IndoorHistory)
        .filter(IndoorHistory.indoor_id == indoor_id)
        .order_by(IndoorHistory.event_ts.desc())
        .limit(limit)
        .all()
    )
    return [{"at": r.event_ts.isoformat(), "message": r.message} for r in rows]


def _plants_list(db: Session, indoor: Indoor) -> list[dict]:
    plants = db.query(Plant).filter(Plant.indoor_id == indoor.id).all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "last_watered_at": str(p.last_watered_at) if p.last_watered_at else None,
            "next_water_at": str(p.next_water_at) if p.next_water_at else None,
            "interval_days": p.watering_interval_days,
        }
        for p in plants
    ]


ANALYSIS_PROMPT = """Analizá este cultivo de interior (coco / SCROG) y devolvé recomendaciones concretas.

ENFOQUE: {focus}
VENTANA: últimos {days} días

ESTADO ACTUAL (JSON):
{status}

ESTADÍSTICAS DE MEDICIONES (JSON):
{stats}

RIEGOS (JSON):
{waterings}

APLICACIONES DE FERTILIZANTE (JSON):
{ferts}

Devolvé, en español y breve:
1) Diagnóstico (2-3 líneas).
2) Desvíos respecto a los objetivos de la etapa.
3) Entre 3 y 5 acciones concretas priorizadas.
No inventes datos que no estén arriba."""


def _analyze_indoor(db: Session, indoor: Indoor, focus: str | None, days: int) -> dict:
    """Run a focused analysis with the stronger model, returning a short summary."""
    status = _indoor_status(db, indoor)
    stats = _measurements_summary(db, indoor.id, days)
    waterings = _watering_history(db, indoor.id, days, limit=20)
    ferts = _fertilizer_applications(db, indoor.id, days, limit=20)

    prompt = ANALYSIS_PROMPT.format(
        focus=focus or "general",
        days=days,
        status=json.dumps(status, ensure_ascii=False, default=str),
        stats=json.dumps(stats, ensure_ascii=False, default=str),
        waterings=json.dumps(waterings, ensure_ascii=False, default=str),
        ferts=json.dumps(ferts, ensure_ascii=False, default=str),
    )

    client = _client()
    kwargs: dict = {
        "model": settings.ai_analysis_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Sos un experto en cultivo de cannabis en interior (fibra de coco, "
                    "SCROG, fertirriego). Respondés en español, breve y accionable."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }
    if settings.ai_analysis_model.startswith(("o1", "o3", "o4")):
        kwargs["max_completion_tokens"] = ANALYSIS_MAX_TOKENS
    else:
        kwargs["max_tokens"] = ANALYSIS_MAX_TOKENS
        kwargs["temperature"] = 0.3

    response = client.chat.completions.create(**kwargs)
    text = response.choices[0].message.content or ""
    return {"days": days, "analysis": text}


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

    if name == "get_measurements_summary":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        return _measurements_summary(db, indoor.id, int(args.get("days") or 14))

    if name == "get_watering_history":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        return {
            "indoor": indoor.name,
            "waterings": _watering_history(db, indoor.id, int(args.get("days") or 30)),
        }

    if name == "get_fertilizer_applications":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        return {
            "indoor": indoor.name,
            "applications": _fertilizer_applications(db, indoor.id, int(args.get("days") or 30)),
        }

    if name == "get_indoor_history":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        return {
            "indoor": indoor.name,
            "events": _indoor_history(db, indoor.id, int(args.get("limit") or 20)),
        }

    if name == "get_plants":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        return {"indoor": indoor.name, "plants": _plants_list(db, indoor)}

    if name == "analyze_indoor":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        return _analyze_indoor(db, indoor, args.get("focus"), int(args.get("days") or 14))

    return {"error": f"Tool desconocida: {name}"}


def _execute_mutation(db: Session, user: User, name: str, args: dict) -> dict:
    if name == "water_indoor":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        liters = float(args.get("liters") or 0)
        if liters <= 0:
            return {"error": "Litros inválidos"}

        plant_ids = args.get("plant_ids")
        plant_names = args.get("plant_names")
        if not plant_ids and plant_names:
            wanted = {str(n).strip().lower() for n in plant_names}
            plants_all = db.query(Plant).filter(Plant.indoor_id == indoor.id).all()
            plant_ids = [str(p.id) for p in plants_all if p.name.strip().lower() in wanted]
            if not plant_ids:
                return {"error": f"No encontré plantas con esos nombres en {indoor.name}"}

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
            plant_ids=plant_ids,
        )
        applied = 0
        for f in args.get("fertilizers") or []:
            fert = _resolve_fertilizer(db, user, f.get("fertilizer_id"))
            if not fert:
                continue
            db.add(FertilizerApplication(
                indoor_id=indoor.id,
                fertilizer_id=fert.id,
                applied_at=now(),
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
            event_ts=now(),
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

        parts = []
        if args.get("temp_c") is not None:
            parts.append(f"temp {args['temp_c']}°C")
        if args.get("humidity") is not None:
            parts.append(f"HR {args['humidity']}%")
        if args.get("ec") is not None:
            parts.append(f"EC {args['ec']}")
        if args.get("ph") is not None:
            parts.append(f"pH {args['ph']}")
        if args.get("runoff_ec") is not None:
            parts.append(f"runoff EC {args['runoff_ec']}")
        if args.get("ppfd") is not None:
            parts.append(f"PPFD {args['ppfd']}")
        detail = f" ({', '.join(parts)})" if parts else ""
        return {"ok": True, "summary": f"Medición registrada en {indoor.name}{detail}."}

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
            applied_at=now(),
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
        task.completed_at = now() if is_done else None
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

    if name == "set_stage":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        stage = args.get("stage")
        if stage not in STAGE_KEYS:
            return {"error": f"Etapa inválida: {stage}"}
        update_indoor(db, indoor, stage=stage)
        return {
            "ok": True,
            "summary": f"Etapa cambiada a {stage_label(stage)} en {indoor.name}.",
        }

    if name == "set_light":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        update_indoor(
            db,
            indoor,
            light_height_cm=args.get("light_height_cm"),
            light_power_pct=args.get("light_power_pct"),
            light_schedule=args.get("light_schedule"),
        )
        parts = []
        if args.get("light_height_cm") is not None:
            parts.append(f"altura {args['light_height_cm']} cm")
        if args.get("light_power_pct") is not None:
            parts.append(f"potencia {args['light_power_pct']}%")
        if args.get("light_schedule") is not None:
            parts.append(f"horario {args['light_schedule']}")
        detail = f" ({', '.join(parts)})" if parts else ""
        return {"ok": True, "summary": f"Luz ajustada en {indoor.name}{detail}."}

    if name == "set_climate":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        update_indoor(
            db,
            indoor,
            humidifier_mode=args.get("humidifier_mode"),
            humidifier_on_below_humidity=args.get("humidifier_on_below_humidity"),
            humidifier_off_above_humidity=args.get("humidifier_off_above_humidity"),
            humidifier_on_above_temp=args.get("humidifier_on_above_temp"),
            humidifier_off_below_temp=args.get("humidifier_off_below_temp"),
            ac_mode=args.get("ac_mode"),
            ac=args.get("ac"),
            ac_hvac_mode=args.get("ac_hvac_mode"),
            ac_on_above_temp=args.get("ac_on_above_temp"),
            ac_off_below_temp=args.get("ac_off_below_temp"),
        )
        return {"ok": True, "summary": f"Clima actualizado en {indoor.name}."}

    if name == "create_task":
        indoor = _resolve_indoor(db, user, args.get("indoor_id"), args.get("indoor_name"))
        if not indoor:
            return {"error": "Indoor no encontrado"}
        title = (args.get("title") or "").strip()
        if not title:
            return {"error": "Falta el título de la tarea"}
        stage = args.get("stage")
        if stage is not None and stage not in STAGE_KEYS:
            return {"error": f"Etapa inválida: {stage}"}
        due_at = args.get("due_at")
        try:
            due_date = date.fromisoformat(due_at) if due_at else None
        except ValueError:
            return {"error": "Fecha inválida (usar YYYY-MM-DD)"}
        db.add(Task(
            indoor_id=indoor.id,
            title=title,
            frequency=args.get("frequency"),
            stage=stage,
            due_at=due_date,
            is_done=False,
        ))
        db.commit()
        return {"ok": True, "summary": f"Tarea '{title}' creada en {indoor.name}."}

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
        env = status["current_environment"]
        lines.append(
            f"  ambiente actual: temp={env['temp_c']}°C, HR={env['humidity']}%, "
            f"EC={env['ec']}, pH={env['ph']}, runoff_EC={env['runoff_ec']}, PPFD={env['ppfd']}, "
            f"luz={env['light_height_cm']}cm/{env['light_power_pct']}%, horario {env['light_schedule']}"
        )
        if status["pending_tasks"]:
            titles = ", ".join(t["title"] for t in status["pending_tasks"][:5])
            extra = "" if len(status["pending_tasks"]) <= 5 else ", …"
            lines.append(
                f"  tareas pendientes ({len(status['pending_tasks'])}): {titles}{extra} "
                f"[usá list_tasks para ids/detalle]"
            )

    lines.append("")
    lines.append("FERTILIZANTES: usá list_fertilizers para ver el catálogo (id, tipo, dosis).")
    return "\n".join(lines)


SYSTEM_PROMPT = """Sos el asistente de PlantulasBot, un experto en cultivo de cannabis en interior (fibra de coco, SCROG, fertirriego).
Respondés SIEMPRE en español, de forma clara, breve y concreta.

REGLAS:
- Para consultar datos usá las tools de lectura (incluye historial, estadísticas y el catálogo de fertilizantes).
- Cada indoor tiene un campo "ambiente actual" (temp, HR, EC, pH, runoff_EC, PPFD y luz) con los últimos valores conocidos. Usá ESOS valores para responder preguntas sobre temperatura, humedad, EC, pH o PPFD. Si un valor es null, recién ahí decí que no está registrado.
- Para análisis profundos (tendencias, planes, ajustes) usá analyze_indoor.
- Para acciones que MODIFICAN datos (regar, medir, fertilizar, completar tarea, cambiar etapa/luz/clima) llamá a la tool correspondiente; el sistema le pedirá confirmación al usuario antes de ejecutar. Nunca digas que ya se ejecutó algo que está pendiente de confirmación.
- Si el usuario te dicta un valor de ambiente (ej: "la carpa está a 24°C y 60% HR"), usá add_measurement para registrarlo (queda pendiente de confirmación).
- No inventes datos: si falta un id o un valor, pedíselo al usuario.
- Fechas en formato YYYY-MM-DD.
- Si el usuario menciona un indoor por nombre, usá el id que figura en el contexto.
- Podés dar consejos de cultivo (EC, pH, PPFD, temperatura, humedad) basados en los objetivos de la etapa.

CONTEXTO ACTUAL:
{context}"""


def _client():
    from openai import OpenAI

    return OpenAI(api_key=settings.openai_api_key)


def _history(db: Session, user: User) -> list[dict]:
    """Recent conversation, compacting older turns to keep the prompt small."""
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.role.in_(["user", "assistant"]))
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_LIMIT)
        .all()
    )
    rows = list(reversed(rows))
    if len(rows) <= HISTORY_RECENT:
        return [{"role": r.role, "content": r.content} for r in rows]

    older, recent = rows[:-HISTORY_RECENT], rows[-HISTORY_RECENT:]
    summary_lines = [
        f"{r.role}: {(r.content or '').strip()[:HISTORY_SNIPPET]}"
        for r in older
    ]
    messages = [
        {
            "role": "system",
            "content": "[Resumen de mensajes anteriores]\n" + "\n".join(summary_lines),
        }
    ]
    messages.extend({"role": r.role, "content": r.content} for r in recent)
    return messages


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

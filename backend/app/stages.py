"""
Cultivation stage definitions and default references.

The stages and default EC/pH targets are based on the grow notes for an
Amnesia SCROG run in coco. Targets are editable per indoor via StageTarget.
"""

# Ordered cultivation stages: (key, label)
STAGES: list[tuple[str, str]] = [
    ("seedling", "Plantín"),
    ("veg_early", "Vege temprano"),
    ("veg_late", "Vege tardío"),
    ("flower_early", "Floración temprana"),
    ("flower_mid", "Floración media"),
    ("flower_late", "Floración tardía"),
    ("flush", "Lavado (flush)"),
]

STAGE_KEYS: list[str] = [key for key, _ in STAGES]
STAGE_LABELS: dict[str, str] = dict(STAGES)

DEFAULT_STAGE: str = "seedling"


def stage_label(key: str | None) -> str | None:
    if key is None:
        return None
    return STAGE_LABELS.get(key, key)


# Default EC/pH targets per stage (from the grow notes).
# pH range for coco is 5.8-6.2 across the whole cycle.
DEFAULT_STAGE_TARGETS: dict[str, dict] = {
    "seedling": {
        "ec_min": 0.6,
        "ec_max": 0.8,
        "ph_min": 5.8,
        "ph_max": 6.2,
        "temp_min": 22,
        "temp_max": 26,
        "humidity_min": 65,
        "humidity_max": 75,
        "light_height_min": 60,
        "light_height_max": 70,
        "ppfd_min": 200,
        "ppfd_max": 400,
        "light_schedule": "18/6",
        "notes": "Enraizante + agua, muy suave.",
    },
    "veg_early": {
        "ec_min": 1.0,
        "ec_max": 1.3,
        "ph_min": 5.8,
        "ph_max": 6.2,
        "temp_min": 22,
        "temp_max": 28,
        "humidity_min": 55,
        "humidity_max": 65,
        "light_height_min": 50,
        "light_height_max": 60,
        "ppfd_min": 300,
        "ppfd_max": 500,
        "light_schedule": "18/6",
        "notes": "Base A+B + Cal-Mag.",
    },
    "veg_late": {
        "ec_min": 1.4,
        "ec_max": 1.6,
        "ph_min": 5.8,
        "ph_max": 6.2,
        "temp_min": 22,
        "temp_max": 28,
        "humidity_min": 55,
        "humidity_max": 65,
        "light_height_min": 45,
        "light_height_max": 55,
        "ppfd_min": 500,
        "ppfd_max": 700,
        "light_schedule": "18/6",
        "notes": "Subir progresivamente.",
    },
    "flower_early": {
        "ec_min": 1.6,
        "ec_max": 1.8,
        "ph_min": 5.8,
        "ph_max": 6.2,
        "temp_min": 20,
        "temp_max": 26,
        "humidity_min": 50,
        "humidity_max": 60,
        "light_height_min": 40,
        "light_height_max": 50,
        "ppfd_min": 600,
        "ppfd_max": 800,
        "light_schedule": "12/12",
        "notes": "Base + inicio de PK.",
    },
    "flower_mid": {
        "ec_min": 1.8,
        "ec_max": 2.0,
        "ph_min": 5.8,
        "ph_max": 6.2,
        "temp_min": 20,
        "temp_max": 26,
        "humidity_min": 45,
        "humidity_max": 55,
        "light_height_min": 35,
        "light_height_max": 45,
        "ppfd_min": 800,
        "ppfd_max": 1000,
        "light_schedule": "12/12",
        "notes": "Pico de PK booster.",
    },
    "flower_late": {
        "ec_min": 1.4,
        "ec_max": 1.6,
        "ph_min": 5.8,
        "ph_max": 6.2,
        "temp_min": 18,
        "temp_max": 24,
        "humidity_min": 40,
        "humidity_max": 50,
        "light_height_min": 30,
        "light_height_max": 40,
        "ppfd_min": 800,
        "ppfd_max": 1000,
        "light_schedule": "12/12",
        "notes": "Bajar EC, preparar lavado de raíces.",
    },
    "flush": {
        "ec_min": 0.0,
        "ec_max": 0.4,
        "ph_min": 5.8,
        "ph_max": 6.2,
        "temp_min": 18,
        "temp_max": 24,
        "humidity_min": 40,
        "humidity_max": 50,
        "light_height_min": 30,
        "light_height_max": 40,
        "ppfd_min": 600,
        "ppfd_max": 800,
        "light_schedule": "12/12",
        "notes": "Flush (solo agua con pH ajustado).",
    },
}


# Default monitoring checklist. `stage` = None means it applies all cycle long.
DEFAULT_TASKS: list[dict] = [
    {
        "title": "Revisar pH y EC del reservorio",
        "frequency": "daily",
        "stage": None,
    },
    {
        "title": "Revisar temperatura y humedad de la carpa",
        "frequency": "daily",
        "stage": None,
    },
    {
        "title": "Chequear que los goteros no estén tapados",
        "frequency": "every_2_3_days",
        "stage": None,
    },
    {
        "title": "Medir EC de runoff",
        "frequency": "weekly",
        "stage": None,
    },
    {
        "title": "Ajustar altura de la lámpara según crecimiento",
        "frequency": "weekly",
        "stage": None,
    },
    {
        "title": "Tejer puntas nuevas en la red SCROG",
        "frequency": "weekly",
        "stage": "veg_late",
    },
    {
        "title": "Podas bajas (lollipopping)",
        "frequency": "weekly",
        "stage": "flower_early",
    },
]

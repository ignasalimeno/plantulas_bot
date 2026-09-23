import { useRef, useState } from "react";
import {
  useStageTargets,
  useUpdateIndoor,
  useCreateMeasurement,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { Chevron } from "./Collapsible";
import { IndoorDetail, IndoorUpdateRequest, MeasurementCreate } from "../api/types";

type Status = "ok" | "low" | "high" | "none";

type AmbienteForm = IndoorUpdateRequest;

type CardSpec = {
  key: string;
  label: string;
  value: number | null;
  at?: string | null;
  source?: string | null;
  min?: number | null;
  max?: number | null;
  unit?: string;
  step: string;
  digits: number;
  save: (value: number | null) => void;
};

const STATUS_STYLES: Record<Status, { card: string; value: string; badge: string; label: string }> = {
  ok: {
    card: "border-blue-500 bg-blue-50",
    value: "text-blue-500",
    badge: "bg-blue-100 text-blue-800",
    label: "OK",
  },
  low: {
    card: "border-yellow-500 bg-yellow-50",
    value: "text-yellow-800",
    badge: "bg-yellow-100 text-yellow-800",
    label: "BAJO",
  },
  high: {
    card: "border-red-400 bg-red-50",
    value: "text-red-700",
    badge: "bg-red-100 text-red-800",
    label: "ALTO",
  },
  none: {
    card: "border-gray-200 bg-gray-50",
    value: "text-gray-500",
    badge: "bg-gray-100 text-gray-600",
    label: "—",
  },
};

function rangeStatus(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined
): Status {
  if (value === null || value === undefined || min === null || min === undefined || max === null || max === undefined) {
    return "none";
  }
  if (value < min) return "low";
  if (value > max) return "high";
  return "ok";
}

function fmtNum(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits).replace(/\.0+$/, "");
}

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "ahora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

const SOURCE_LABELS: Record<string, string> = {
  measurement: "medición",
  watering: "riego",
  indoor: "manual",
};

type HumidifierRecommendation = "on" | "off" | null;

function humidifierRecommendation(
  indoor: IndoorDetail,
  tempValue: number | null | undefined,
  humidityValue: number | null | undefined
): HumidifierRecommendation {
  const {
    humidifier_off_above_humidity,
    humidifier_off_below_temp,
    humidifier_on_below_humidity,
    humidifier_on_above_temp,
  } = indoor;

  if (
    humidifier_off_above_humidity != null &&
    humidityValue != null &&
    humidityValue > humidifier_off_above_humidity
  ) {
    return "off";
  }
  if (
    humidifier_off_below_temp != null &&
    tempValue != null &&
    tempValue < humidifier_off_below_temp
  ) {
    return "off";
  }
  if (
    humidifier_on_below_humidity != null &&
    humidityValue != null &&
    humidityValue < humidifier_on_below_humidity
  ) {
    return "on";
  }
  if (
    humidifier_on_above_temp != null &&
    tempValue != null &&
    tempValue > humidifier_on_above_temp
  ) {
    return "on";
  }
  return null;
}

function ReadingCard({
  label,
  value,
  at,
  source,
  min,
  max,
  unit,
  step = "0.1",
  digits = 1,
  status,
  saving,
  onSave,
}: {
  label: string;
  value: number | null;
  at?: string | null;
  source?: string | null;
  min?: number | null;
  max?: number | null;
  unit?: string;
  step?: string;
  digits?: number;
  status: Status;
  saving?: boolean;
  onSave: (value: number | null) => void;
}) {
  const s = STATUS_STYLES[status];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const doneRef = useRef(false);

  const startEdit = () => {
    setDraft(value != null ? String(value) : "");
    doneRef.current = false;
    setEditing(true);
  };

  const finish = (save: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    if (!save) return;
    const trimmed = draft.trim();
    if (trimmed === "") return;
    const num = Number(trimmed);
    if (Number.isNaN(num)) return;
    if (value != null && Number(value) === num) return;
    onSave(num);
  };

  const recency = timeAgo(at);
  const sourceLabel = source ? SOURCE_LABELS[source] ?? source : null;

  return (
    <div className={`border rounded-sm p-3 ${s.card}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold ${s.badge}`}>
            {s.label}
          </span>
          {!editing && (
            <button
              onClick={startEdit}
              title="Editar"
              className="text-gray-400 hover:text-blue-500 text-xs leading-none"
            >
              ✎
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <input
          autoFocus
          type="number"
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finish(true);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              finish(false);
            }
          }}
          disabled={saving}
          className="w-full mt-2 px-2 py-1 bg-white border border-blue-400 rounded-sm text-xl font-bold text-gray-800 focus:outline-none"
        />
      ) : (
        <button onClick={startEdit} className="block w-full text-left" title="Click para editar">
          <p className={`text-2xl font-bold leading-none mt-2 ${s.value}`}>
            {fmtNum(value, digits)}
          </p>
        </button>
      )}

      <div className="flex items-center justify-between mt-1 min-h-[14px]">
        {min != null || max != null ? (
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            ideal {fmtNum(min)}–{fmtNum(max)}
            {unit ? ` ${unit}` : ""}
          </p>
        ) : (
          <span />
        )}
        {(sourceLabel || recency) && (
          <span className="text-[10px] text-gray-400">
            {sourceLabel}
            {sourceLabel && recency ? " · " : ""}
            {recency}
          </span>
        )}
      </div>
    </div>
  );
}

export function AmbientePanel({
  indoor,
  onUpdated,
}: {
  indoor: IndoorDetail;
  onUpdated: () => void;
}) {
  const { data: targets } = useStageTargets(indoor.id);
  const { updateIndoor, loading: saving } = useUpdateIndoor();
  const { createMeasurement } = useCreateMeasurement();
  const { toasts, showToast, removeToast } = useToast();

  const [open, setOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<AmbienteForm>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  const env = indoor.current_environment;
  const target = targets?.find((t) => t.stage === indoor.stage) ?? null;

  const handleChange = (field: keyof AmbienteForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await updateIndoor(indoor.id, formData);
      showToast("Ambiente guardado", "success");
      setEditMode(false);
      setFormData({});
      onUpdated();
    } catch {
      showToast("Error al guardar", "error");
    }
  };

  const saveReading = async (field: string, value: number | null) => {
    if (value == null) return;
    setSavingField(field);
    try {
      await createMeasurement(indoor.id, { [field]: value } as MeasurementCreate);
      showToast("Lectura guardada", "success");
      onUpdated();
    } catch {
      showToast("Error al guardar la lectura", "error");
    } finally {
      setSavingField(null);
    }
  };

  const saveSetting = async (field: keyof IndoorUpdateRequest, value: number | null) => {
    if (value == null) return;
    setSavingField(field);
    try {
      await updateIndoor(indoor.id, { [field]: value } as IndoorUpdateRequest);
      showToast("Guardado", "success");
      onUpdated();
    } catch {
      showToast("Error al guardar", "error");
    } finally {
      setSavingField(null);
    }
  };

  const handleToggleHumidifier = async () => {
    try {
      await updateIndoor(indoor.id, { humidifier: !indoor.humidifier });
      onUpdated();
    } catch {
      showToast("Error al actualizar el humidificador", "error");
    }
  };

  const handleSetMode = async (field: "humidifier_mode" | "ac_mode", value: string) => {
    try {
      await updateIndoor(indoor.id, { [field]: value });
      onUpdated();
    } catch {
      showToast("Error al cambiar el modo", "error");
    }
  };

  const handleToggleAc = async () => {
    try {
      await updateIndoor(indoor.id, { ac: !indoor.ac });
      onUpdated();
    } catch {
      showToast("Error al actualizar el aire", "error");
    }
  };

  const tempValue = env?.temp_c?.value ?? indoor.temp_c;
  const humidityValue = env?.humidity?.value ?? indoor.humidity;
  const recommendation = humidifierRecommendation(indoor, tempValue, humidityValue);

  const acRecommendation: "on" | "off" | null =
    tempValue == null
      ? null
      : indoor.ac_on_above_temp != null && tempValue > indoor.ac_on_above_temp
      ? "on"
      : indoor.ac_off_below_temp != null && tempValue < indoor.ac_off_below_temp
      ? "off"
      : null;

  const readingCards: CardSpec[] = [
    {
      key: "ec",
      label: "EC",
      value: env?.ec?.value ?? null,
      at: env?.ec?.at,
      source: env?.ec?.source,
      min: target?.ec_min,
      max: target?.ec_max,
      unit: "mS/cm",
      step: "0.01",
      digits: 2,
      save: (v: number | null) => saveReading("ec", v),
    },
    {
      key: "ph",
      label: "pH",
      value: env?.ph?.value ?? null,
      at: env?.ph?.at,
      source: env?.ph?.source,
      min: target?.ph_min,
      max: target?.ph_max,
      unit: "",
      step: "0.01",
      digits: 2,
      save: (v: number | null) => saveReading("ph", v),
    },
    {
      key: "temp_c",
      label: "Temperatura",
      value: env?.temp_c?.value ?? null,
      at: env?.temp_c?.at,
      source: env?.temp_c?.source,
      min: target?.temp_min,
      max: target?.temp_max,
      unit: "°C",
      step: "0.1",
      digits: 1,
      save: (v: number | null) => saveReading("temp_c", v),
    },
    {
      key: "humidity",
      label: "Humedad",
      value: env?.humidity?.value ?? null,
      at: env?.humidity?.at,
      source: env?.humidity?.source,
      min: target?.humidity_min,
      max: target?.humidity_max,
      unit: "%",
      step: "1",
      digits: 0,
      save: (v: number | null) => saveReading("humidity", v),
    },
    {
      key: "runoff_ec",
      label: "EC runoff",
      value: env?.runoff_ec?.value ?? null,
      at: env?.runoff_ec?.at,
      source: env?.runoff_ec?.source,
      min: null,
      max: null,
      unit: "",
      step: "0.01",
      digits: 2,
      save: (v: number | null) => saveReading("runoff_ec", v),
    },
    {
      key: "ppfd",
      label: "PPFD",
      value: env?.ppfd?.value ?? null,
      at: env?.ppfd?.at,
      source: env?.ppfd?.source,
      min: target?.ppfd_min,
      max: target?.ppfd_max,
      unit: "",
      step: "1",
      digits: 0,
      save: (v: number | null) => saveReading("ppfd", v),
    },
    {
      key: "light_height_cm",
      label: "Altura luz",
      value: env?.light_height_cm ?? indoor.light_height_cm ?? null,
      min: target?.light_height_min,
      max: target?.light_height_max,
      unit: "cm",
      step: "1",
      digits: 0,
      save: (v: number | null) => saveSetting("light_height_cm", v),
    },
    {
      key: "light_power_pct",
      label: "Potencia",
      value: env?.light_power_pct ?? indoor.light_power_pct ?? null,
      min: null,
      max: null,
      unit: "%",
      step: "1",
      digits: 0,
      save: (v: number | null) => saveSetting("light_power_pct", v),
    },
  ];

  const scheduleOk =
    target?.light_schedule != null &&
    indoor.light_schedule != null &&
    target.light_schedule === indoor.light_schedule;
  const scheduleStatus: Status =
    target?.light_schedule == null || indoor.light_schedule == null
      ? "none"
      : scheduleOk
      ? "ok"
      : "high";

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h3 className="section-title text-lg font-semibold text-gray-800">Ambiente</h3>
        </button>
        {editMode ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditMode(false);
                setFormData({});
              }}
              className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-xs uppercase tracking-wider bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
          >
            Editar ajustes
          </button>
        )}
      </div>

      {open &&
        (editMode ? (
          <div className="space-y-6">
            <div>
              <p className="field-label">Ventilación</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ubicación ventilador</label>
                  <input
                    type="text"
                    value={formData.fan_location ?? indoor.fan_location ?? ""}
                    onChange={(e) => handleChange("fan_location", e.target.value || null)}
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.extractor_top ?? indoor.extractor_top}
                      onChange={(e) => handleChange("extractor_top", e.target.checked)}
                    />
                    Extractor arriba
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.extractor_bottom ?? indoor.extractor_bottom}
                      onChange={(e) => handleChange("extractor_bottom", e.target.checked)}
                    />
                    Extractor abajo
                  </label>
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.fan ?? indoor.fan}
                      onChange={(e) => handleChange("fan", e.target.checked)}
                    />
                    Ventilador
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.humidifier ?? indoor.humidifier}
                      onChange={(e) => handleChange("humidifier", e.target.checked)}
                    />
                    Humidificador
                  </label>
                </div>
              </div>
            </div>

            <div>
              <p className="field-label">Humidificador — umbrales</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Encender si HR &lt;</label>
                  <input
                    type="number"
                    step="1"
                    value={
                      formData.humidifier_on_below_humidity ??
                      indoor.humidifier_on_below_humidity ??
                      ""
                    }
                    onChange={(e) =>
                      handleChange(
                        "humidifier_on_below_humidity",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apagar si HR &gt;</label>
                  <input
                    type="number"
                    step="1"
                    value={
                      formData.humidifier_off_above_humidity ??
                      indoor.humidifier_off_above_humidity ??
                      ""
                    }
                    onChange={(e) =>
                      handleChange(
                        "humidifier_off_above_humidity",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Encender si temp &gt;</label>
                  <input
                    type="number"
                    step="0.1"
                    value={
                      formData.humidifier_on_above_temp ?? indoor.humidifier_on_above_temp ?? ""
                    }
                    onChange={(e) =>
                      handleChange(
                        "humidifier_on_above_temp",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apagar si temp &lt;</label>
                  <input
                    type="number"
                    step="0.1"
                    value={
                      formData.humidifier_off_below_temp ?? indoor.humidifier_off_below_temp ?? ""
                    }
                    onChange={(e) =>
                      handleChange(
                        "humidifier_off_below_temp",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="field-label">Aire acondicionado — umbrales</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Encender si temp &gt;</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.ac_on_above_temp ?? indoor.ac_on_above_temp ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "ac_on_above_temp",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apagar si temp &lt;</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.ac_off_below_temp ?? indoor.ac_off_below_temp ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "ac_off_below_temp",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Modo HVAC</label>
                  <select
                    value={formData.ac_hvac_mode ?? indoor.ac_hvac_mode ?? "cool"}
                    onChange={(e) => handleChange("ac_hvac_mode", e.target.value)}
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="cool">Frío (cool)</option>
                    <option value="heat">Calor (heat)</option>
                    <option value="fan">Ventilador (fan)</option>
                    <option value="dry">Deshumidificar (dry)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <p className="field-label">Luz</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Altura (cm)</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.light_height_cm ?? indoor.light_height_cm ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "light_height_cm",
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Potencia (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.light_power_pct ?? indoor.light_power_pct ?? ""}
                    onChange={(e) => handleChange("light_power_pct", parseInt(e.target.value))}
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Horario</label>
                  <input
                    type="text"
                    value={formData.light_schedule ?? indoor.light_schedule ?? ""}
                    onChange={(e) => handleChange("light_schedule", e.target.value || null)}
                    placeholder="18/6"
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {readingCards.map((card) => (
                <ReadingCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  at={card.at}
                  source={card.source}
                  min={card.min}
                  max={card.max}
                  unit={card.unit}
                  step={card.step}
                  digits={card.digits}
                  status={rangeStatus(card.value, card.min, card.max)}
                  saving={savingField === card.key}
                  onSave={card.save}
                />
              ))}

              <div
                className={`border rounded-sm p-3 ${
                  scheduleStatus === "ok" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Horario luz</p>
                <p className="text-2xl font-bold leading-none mt-2 text-gray-800">
                  {indoor.light_schedule || "—"}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                  ideal {target?.light_schedule || "—"}
                </p>
              </div>

              <div className="border border-gray-200 rounded-sm p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">
                    Humidificador
                  </p>
                  <select
                    value={indoor.humidifier_mode}
                    onChange={(e) => handleSetMode("humidifier_mode", e.target.value)}
                    className="text-[10px] uppercase tracking-wider bg-gray-50 border border-gray-300 rounded-sm px-1 py-0.5"
                  >
                    <option value="auto">auto</option>
                    <option value="manual">manual</option>
                    <option value="off">off</option>
                  </select>
                </div>
                {indoor.humidifier_mode === "manual" ? (
                  <button
                    onClick={handleToggleHumidifier}
                    className={`mt-2 px-3 py-1 rounded-sm text-xs uppercase tracking-wider ${
                      indoor.humidifier
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "border border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {indoor.humidifier ? "● ON" : "○ OFF"}
                  </button>
                ) : indoor.humidifier_mode === "auto" ? (
                  <>
                    <p
                      className={`text-2xl font-bold leading-none mt-2 ${
                        recommendation === "on" ? "text-blue-500" : "text-gray-500"
                      }`}
                    >
                      {recommendation === "on" ? "ON" : recommendation === "off" ? "OFF" : "—"}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                      según umbrales
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold leading-none mt-2 text-gray-400">OFF</p>
                )}
              </div>

              <div className="border border-gray-200 rounded-sm p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">Aire</p>
                  <select
                    value={indoor.ac_mode}
                    onChange={(e) => handleSetMode("ac_mode", e.target.value)}
                    className="text-[10px] uppercase tracking-wider bg-gray-50 border border-gray-300 rounded-sm px-1 py-0.5"
                  >
                    <option value="auto">auto</option>
                    <option value="manual">manual</option>
                    <option value="off">off</option>
                  </select>
                </div>
                {indoor.ac_mode === "manual" ? (
                  <button
                    onClick={handleToggleAc}
                    className={`mt-2 px-3 py-1 rounded-sm text-xs uppercase tracking-wider ${
                      indoor.ac
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "border border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {indoor.ac ? "● ON" : "○ OFF"}
                  </button>
                ) : indoor.ac_mode === "auto" ? (
                  <>
                    <p
                      className={`text-2xl font-bold leading-none mt-2 ${
                        acRecommendation === "on" ? "text-blue-500" : "text-gray-500"
                      }`}
                    >
                      {acRecommendation === "on"
                        ? "ON"
                        : acRecommendation === "off"
                        ? "OFF"
                        : "—"}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                      según temperatura
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold leading-none mt-2 text-gray-400">OFF</p>
                )}
              </div>
            </div>
          </>
        ))}
    </div>
  );
}

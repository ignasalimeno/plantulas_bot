import { useState } from "react";
import {
  useMeasurements,
  useStageTargets,
  useUpdateIndoor,
  useCreateMeasurement,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { Chevron } from "./Collapsible";
import { IndoorDetail, IndoorUpdateRequest } from "../api/types";

type Status = "ok" | "low" | "high" | "none";

type AmbienteForm = IndoorUpdateRequest & { ppfd?: number | null };

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

function IndicatorCard({
  label,
  value,
  min,
  max,
  unit,
  status,
}: {
  label: string;
  value: string;
  min: number | null | undefined;
  max: number | null | undefined;
  unit?: string;
  status: Status;
}) {
  const s = STATUS_STYLES[status];
  return (
    <div className={`border rounded-sm p-3 ${s.card}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold ${s.badge}`}>
          {s.label}
        </span>
      </div>
      <p className={`text-2xl font-bold leading-none mt-2 ${s.value}`}>{value}</p>
      {(min != null || max != null) && (
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
          ideal {fmtNum(min)}–{fmtNum(max)}
          {unit ? ` ${unit}` : ""}
        </p>
      )}
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
  const { data: measurements, refetch: refetchMeasurements } = useMeasurements(indoor.id);
  const { data: targets } = useStageTargets(indoor.id);
  const { updateIndoor, loading: saving } = useUpdateIndoor();
  const { createMeasurement } = useCreateMeasurement();
  const { toasts, showToast, removeToast } = useToast();

  const [open, setOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<AmbienteForm>({});

  const latest =
    measurements?.find((m) => m.temp_c != null || m.humidity != null) ?? null;
  const latestPpfd = measurements?.find((m) => m.ppfd != null) ?? null;
  const target = targets?.find((t) => t.stage === indoor.stage) ?? null;

  const handleChange = (field: keyof AmbienteForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const { ppfd, ...indoorUpdates } = formData;
      await updateIndoor(indoor.id, indoorUpdates);
      if (ppfd != null && ppfd !== latestPpfd?.ppfd) {
        await createMeasurement(indoor.id, { ppfd });
        refetchMeasurements();
      }
      showToast("Ambiente guardado", "success");
      setEditMode(false);
      setFormData({});
      onUpdated();
    } catch {
      showToast("Error al guardar", "error");
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

  const tempValue = latest?.temp_c ?? indoor.temp_c;
  const humidityValue = latest?.humidity ?? indoor.humidity;
  const recommendation = humidifierRecommendation(indoor, tempValue, humidityValue);

  const acRecommendation: "on" | "off" | null =
    tempValue == null
      ? null
      : indoor.ac_on_above_temp != null && tempValue > indoor.ac_on_above_temp
      ? "on"
      : indoor.ac_off_below_temp != null && tempValue < indoor.ac_off_below_temp
      ? "off"
      : null;

  const indicators = [
    {
      label: "EC",
      value: fmtNum(latest?.ec, 2),
      min: target?.ec_min,
      max: target?.ec_max,
      unit: "mS/cm",
      status: rangeStatus(latest?.ec, target?.ec_min, target?.ec_max),
    },
    {
      label: "pH",
      value: fmtNum(latest?.ph, 2),
      min: target?.ph_min,
      max: target?.ph_max,
      unit: "",
      status: rangeStatus(latest?.ph, target?.ph_min, target?.ph_max),
    },
    {
      label: "Temperatura",
      value: fmtNum(tempValue, 1),
      min: target?.temp_min,
      max: target?.temp_max,
      unit: "°C",
      status: rangeStatus(tempValue, target?.temp_min, target?.temp_max),
    },
    {
      label: "Humedad",
      value: fmtNum(humidityValue, 0),
      min: target?.humidity_min,
      max: target?.humidity_max,
      unit: "%",
      status: rangeStatus(humidityValue, target?.humidity_min, target?.humidity_max),
    },
    {
      label: "Altura luz",
      value: fmtNum(indoor.light_height_cm, 0),
      min: target?.light_height_min,
      max: target?.light_height_max,
      unit: "cm",
      status: rangeStatus(indoor.light_height_cm, target?.light_height_min, target?.light_height_max),
    },
    {
      label: "Potencia",
      value: fmtNum(indoor.light_power_pct, 0),
      min: null,
      max: null,
      unit: "%",
      status: "none" as Status,
    },
    {
      label: "PPFD",
      value: fmtNum(latestPpfd?.ppfd, 0),
      min: target?.ppfd_min,
      max: target?.ppfd_max,
      unit: "",
      status: rangeStatus(latestPpfd?.ppfd, target?.ppfd_min, target?.ppfd_max),
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
            Editar
          </button>
        )}
      </div>

      {open &&
        (editMode ? (
          <div className="space-y-6">
            <div>
              <p className="field-label">Ambiente</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Temperatura (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temp_c ?? indoor.temp_c ?? ""}
                    onChange={(e) =>
                      handleChange("temp_c", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Humedad (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.humidity ?? indoor.humidity ?? ""}
                    onChange={(e) =>
                      handleChange("humidity", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ubicación ventilador</label>
                  <input
                    type="text"
                    value={formData.fan_location ?? indoor.fan_location ?? ""}
                    onChange={(e) => handleChange("fan_location", e.target.value || null)}
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ventilación</label>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <label className="block text-xs text-gray-500 mb-1">PPFD</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.ppfd ?? latestPpfd?.ppfd ?? ""}
                    onChange={(e) =>
                      handleChange("ppfd", e.target.value ? parseInt(e.target.value) : null)
                    }
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
              {indicators.map((ind) => (
                <IndicatorCard key={ind.label} {...ind} />
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
            {latest && (
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-3">
                Basado en la última medición:{" "}
                {new Date(latest.event_ts).toLocaleString("es-ES")}
              </p>
            )}
          </>
        ))}
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  useStageTargets,
  useUpdateIndoor,
  useCreateMeasurement,
  useIndoorWateringHistory,
  useMeasurements,
  useDevices,
  useAlerts,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { Chevron } from "./Collapsible";
import { AlertsModal } from "./Alerts";
import { ReadingCard, rangeStatus, fmtDateTime, CardSpec, Status } from "./Readings";
import { MetricChart, Sparkline, ChartPoint } from "./MetricChart";
import { IndoorDetail, IndoorUpdateRequest, MeasurementCreate, IndoorHistory, Measurement } from "../api/types";

type AmbienteForm = IndoorUpdateRequest;

type DeviceField = "ac" | "humidifier" | "extractor_top" | "extractor_bottom" | "fan" | "pump";

type ChartMetric =
  | { kind: "reading"; field: string; label: string; unit?: string; base: number; spread: number }
  | { kind: "device"; field: string; label: string; eventLabel: string };

function simulateReading(base: number, spread: number, hours = 24, n = 48): ChartPoint[] {
  const now = Date.now();
  const pts: ChartPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = now - (hours * 3600 * 1000 * (n - 1 - i)) / (n - 1);
    const v = base + Math.sin(i / 4) * spread + (Math.random() - 0.5) * spread * 0.4;
    pts.push({ t, v: Math.round(v * 10) / 10 });
  }
  return pts;
}

function simulateDevice(hours = 24, n = 16): ChartPoint[] {
  const now = Date.now();
  const pts: ChartPoint[] = [];
  let state = Math.random() > 0.5 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const t = now - (hours * 3600 * 1000 * (n - 1 - i)) / (n - 1);
    if (Math.random() < 0.35) state = state ? 0 : 1;
    pts.push({ t, v: state });
  }
  return pts;
}

const WINDOW_MS = 24 * 3600 * 1000;

const READING_CHART: Record<string, { base: number; spread: number }> = {
  temp_c: { base: 24, spread: 3 },
  humidity: { base: 60, spread: 12 },
};

const DEVICE_METRICS: Array<{ field: string; label: string; eventLabel: string }> = [
  { field: "ac", label: "Aire", eventLabel: "Aire acondicionado" },
  { field: "humidifier", label: "Humidificador", eventLabel: "Humidificador" },
];

function buildReadingSeries(
  measurements: Measurement[] | null | undefined,
  field: string,
  base: number,
  spread: number
): { points: ChartPoint[]; simulated: boolean } {
  const cutoff = Date.now() - WINDOW_MS;
  const real = (measurements ?? [])
    .map((m) => ({ m, v: (m as unknown as Record<string, number | null>)[field] }))
    .filter((x) => x.v != null && new Date(x.m.event_ts).getTime() >= cutoff)
    .map((x) => ({ t: new Date(x.m.event_ts).getTime(), v: Number(x.v) }))
    .sort((a, b) => a.t - b.t);
  if (real.length >= 2) return { points: real, simulated: false };
  return { points: simulateReading(base, spread), simulated: true };
}

function buildDeviceSeries(
  events: IndoorHistory[] | null | undefined,
  eventLabel: string
): { points: ChartPoint[]; simulated: boolean } {
  const cutoff = Date.now() - WINDOW_MS;
  const real = (events ?? [])
    .filter((e) => e.message.startsWith(eventLabel + ":") && new Date(e.event_ts).getTime() >= cutoff)
    .map((e) => ({ t: new Date(e.event_ts).getTime(), v: e.message.includes("ON") ? 1 : 0 }))
    .sort((a, b) => a.t - b.t);
  if (real.length >= 2) return { points: real, simulated: false };
  return { points: simulateDevice(), simulated: true };
}

function DeviceCard({
  title,
  active,
  manual,
  lastContact,
  spark,
  onToggle,
  onChart,
}: {
  title: string;
  active: boolean;
  manual: boolean;
  lastContact?: string | null;
  spark?: ChartPoint[];
  onToggle: () => void;
  onChart?: () => void;
}) {
  return (
    <div
      className={`border rounded-sm p-3 ${
        active ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`led shrink-0 ${active ? "bg-green-500" : "bg-gray-300"}`} />
          <button
            onClick={onChart}
            title="Ver historial"
            className="text-[10px] uppercase tracking-widest text-gray-500 truncate hover:text-blue-500"
          >
            {title}
          </button>
        </div>
        <button
          onClick={onToggle}
          title="Cambiar manualmente"
          className={`px-3 py-1 rounded-sm text-xs uppercase tracking-wider shrink-0 ${
            active
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "border border-gray-300 text-gray-600 hover:bg-gray-100"
          }`}
        >
          {active ? "● ON" : "○ OFF"}
        </button>
      </div>
      {spark && spark.length >= 2 && (
        <button onClick={onChart} className="block w-full mt-1" title="Expandir gráfico">
          <Sparkline points={spark} step color="#FFB000" height={24} />
        </button>
      )}
      <p className="text-[10px] text-gray-400 mt-2">
        {manual ? "manual" : "HA"} · último contacto: {fmtDateTime(lastContact)}
      </p>
    </div>
  );
}

export function AmbientePanel({
  indoor,
  events,
  onUpdated,
}: {
  indoor: IndoorDetail;
  events: IndoorHistory[];
  onUpdated: () => void;
}) {
  const { data: targets } = useStageTargets(indoor.id);
  const { data: history, refetch: refetchHistory } = useIndoorWateringHistory(indoor.id);
  const { data: devices, refetch: refetchDevices } = useDevices(indoor.id);
  const { data: measurements } = useMeasurements(indoor.id);
  const { data: alerts } = useAlerts(indoor.id);
  const { updateIndoor, loading: saving } = useUpdateIndoor();
  const { createMeasurement } = useCreateMeasurement();
  const { toasts, showToast, removeToast } = useToast();

  const [open, setOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<AmbienteForm>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [chart, setChart] = useState<ChartMetric | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const env = indoor.current_environment;
  const target = targets?.find((t) => t.stage === indoor.stage) ?? null;
  const lastWatering = history && history.length > 0 ? history[0] : null;

  const device = devices && devices.length > 0 ? devices[0] : null;
  const reported = (device?.reported_state ?? {}) as Record<string, unknown>;
  const lastContact = device?.last_seen ?? null;

  const deviceState = (field: string, indoorValue: boolean) => {
    const ha = reported[field];
    if (typeof ha === "boolean") return { active: ha, manual: false };
    return { active: indoorValue, manual: true };
  };

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

  const refreshNow = () => {
    refetchDevices();
    refetchHistory();
    onUpdated();
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

  const toggleDevice = async (field: DeviceField) => {
    try {
      await updateIndoor(indoor.id, { [field]: !indoor[field] } as IndoorUpdateRequest);
      onUpdated();
    } catch {
      showToast("Error al actualizar el dispositivo", "error");
    }
  };

  const climateCards: CardSpec[] = [
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
      save: (v) => saveReading("temp_c", v),
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
      save: (v) => saveReading("humidity", v),
    },
  ];

  const lightCards: CardSpec[] = [
    {
      key: "light_height_cm",
      label: "Altura luz",
      value: env?.light_height_cm ?? indoor.light_height_cm ?? null,
      min: target?.light_height_min,
      max: target?.light_height_max,
      unit: "cm",
      step: "1",
      digits: 0,
      save: (v) => saveSetting("light_height_cm", v),
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
      save: (v) => saveSetting("light_power_pct", v),
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
      save: (v) => saveReading("ppfd", v),
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

  const ac = deviceState("ac", indoor.ac);
  const humidifier = deviceState("humidifier", indoor.humidifier);
  const extractor = deviceState("extractor", indoor.extractor_top);
  const intractor = deviceState("intractor", indoor.extractor_bottom);
  const fan = deviceState("fan", indoor.fan);
  const pump = deviceState("pump", indoor.pump);

  const seriesMap = useMemo(() => {
    const map: Record<string, { points: ChartPoint[]; simulated: boolean }> = {};
    Object.entries(READING_CHART).forEach(([field, cfg]) => {
      map[`reading:${field}`] = buildReadingSeries(measurements, field, cfg.base, cfg.spread);
    });
    DEVICE_METRICS.forEach((d) => {
      map[`device:${d.field}`] = buildDeviceSeries(events, d.eventLabel);
    });
    return map;
  }, [measurements, events]);

  const openReadingChart = (card: CardSpec) => {
    const cfg = READING_CHART[card.key];
    if (!cfg) return;
    setChart({
      kind: "reading",
      field: card.key,
      label: card.label,
      unit: card.unit,
      base: cfg.base,
      spread: cfg.spread,
    });
  };

  const openDeviceChart = (field: string, label: string, eventLabel: string) => {
    setChart({ kind: "device", field, label, eventLabel });
  };

  const chartData = chart
    ? seriesMap[`${chart.kind}:${chart.field}`] ?? { points: [] as ChartPoint[], simulated: false }
    : { points: [] as ChartPoint[], simulated: false };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h3 className="section-title text-lg font-semibold text-gray-800">
            Dispositivos & Ambiente
          </h3>
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setAlertsOpen(true)}
            className="relative px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
          >
            Alertas
            {alerts && alerts.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] leading-none rounded-full px-1.5 py-0.5">
                {alerts.length}
              </span>
            )}
          </button>
          <button
            onClick={refreshNow}
            className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
          >
            Actualizar ahora
          </button>
          {editMode ? (
            <>
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
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
            >
              Editar ajustes
            </button>
          )}
        </div>
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
              </div>
            </div>

            <div>
              <p className="field-label">Luz — horario</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
          <div className="space-y-6">
            {/* 1. Clima + Aire/Humidificador */}
            <div>
              <p className="field-label">Clima & Actuadores</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {climateCards.map((card) => (
                  <ReadingCard
                    key={card.key}
                    label={card.label}
                    value={card.value}
                    at={card.at ?? indoor.updated_at}
                    source={card.source}
                    min={card.min}
                    max={card.max}
                    unit={card.unit}
                    step={card.step}
                    digits={card.digits}
                    size="lg"
                    status={rangeStatus(card.value, card.min, card.max)}
                    saving={savingField === card.key}
                    onSave={card.save}
                    spark={seriesMap[`reading:${card.key}`]?.points}
                    onChart={READING_CHART[card.key] ? () => openReadingChart(card) : undefined}
                  />
                ))}
                <DeviceCard
                  title="Aire"
                  active={ac.active}
                  manual={ac.manual}
                  lastContact={lastContact}
                  spark={seriesMap["device:ac"]?.points}
                  onToggle={() => toggleDevice("ac")}
                  onChart={() => openDeviceChart("ac", "Aire", "Aire acondicionado")}
                />
                <DeviceCard
                  title="Humidificador"
                  active={humidifier.active}
                  manual={humidifier.manual}
                  lastContact={lastContact}
                  spark={seriesMap["device:humidifier"]?.points}
                  onToggle={() => toggleDevice("humidifier")}
                  onChart={() => openDeviceChart("humidifier", "Humidificador", "Humidificador")}
                />
              </div>
            </div>

            {/* 2. Ventiladores + Bomba */}
            <div>
              <p className="field-label">Ventiladores & Bomba</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DeviceCard
                  title="Extractor"
                  active={extractor.active}
                  manual={extractor.manual}
                  lastContact={lastContact}
                  onToggle={() => toggleDevice("extractor_top")}
                />
                <DeviceCard
                  title="Intractor"
                  active={intractor.active}
                  manual={intractor.manual}
                  lastContact={lastContact}
                  onToggle={() => toggleDevice("extractor_bottom")}
                />
                <DeviceCard
                  title="Ventilador interno"
                  active={fan.active}
                  manual={fan.manual}
                  lastContact={lastContact}
                  onToggle={() => toggleDevice("fan")}
                />
                <DeviceCard
                  title="Bomba de riego"
                  active={pump.active}
                  manual={pump.manual}
                  lastContact={lastContact}
                  onToggle={() => toggleDevice("pump")}
                />
              </div>
            </div>

            {/* 3. Riego + Luz */}
            <div>
              <p className="field-label">Riego & Luz</p>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="border border-gray-200 rounded-sm p-3">
                  <div className="flex items-center gap-2">
                    <span className="led bg-gray-300" />
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">
                      Último riego
                    </p>
                  </div>
                  <p className="text-2xl font-bold leading-none mt-2 text-gray-800">
                    {lastWatering ? `${lastWatering.liters} L` : "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                    {lastWatering
                      ? `${lastWatering.plants.length} planta(s)` +
                        (lastWatering.ec != null ? ` · EC ${lastWatering.ec}` : "") +
                        (lastWatering.ph != null ? ` · pH ${lastWatering.ph}` : "")
                      : "sin riegos registrados"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {lastWatering ? `fue el ${fmtDateTime(lastWatering.event_ts)}` : "—"}
                  </p>
                </div>

                {lightCards.map((card) => (
                  <ReadingCard
                    key={card.key}
                    label={card.label}
                    value={card.value}
                    at={card.at ?? indoor.updated_at}
                    source={card.source}
                    min={card.min}
                    max={card.max}
                    unit={card.unit}
                    step={card.step}
                    digits={card.digits}
                    status={rangeStatus(card.value, card.min, card.max)}
                    saving={savingField === card.key}
                    onSave={card.save}
                    spark={seriesMap[`reading:${card.key}`]?.points}
                    onChart={READING_CHART[card.key] ? () => openReadingChart(card) : undefined}
                  />
                ))}

                <div
                  className={`border rounded-sm p-3 ${
                    scheduleStatus === "ok"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`led ${
                        scheduleStatus === "ok" ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">
                      Horario luz
                    </p>
                  </div>
                  <p className="text-2xl font-bold leading-none mt-2 text-gray-800">
                    {indoor.light_schedule || "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                    ideal {target?.light_schedule || "—"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    última medición: {fmtDateTime(indoor.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

      {chart && (
        <MetricChart
          title={chart.label}
          unit={chart.kind === "reading" ? chart.unit : undefined}
          points={chartData.points}
          step={chart.kind === "device"}
          color={chart.kind === "device" ? "#FFB000" : "#7CE38B"}
          simulated={chartData.simulated}
          onClose={() => setChart(null)}
        />
      )}

      {alertsOpen && (
        <AlertsModal indoorId={indoor.id} onClose={() => setAlertsOpen(false)} />
      )}
    </div>
  );
}

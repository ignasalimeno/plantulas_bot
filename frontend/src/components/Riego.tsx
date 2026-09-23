import { useMemo, useState } from "react";
import {
  useIndoorWateringHistory,
  useWaterIndoor,
  useUpdateWateringEvent,
  useDeleteWateringEvent,
  useFertilizerPlan,
  useFertilizers,
  useStageTargets,
  useCreateMeasurement,
  useToast,
} from "../hooks";
import { ToastContainer, ConfirmDialog } from "./Modals";
import { Chevron } from "./Collapsible";
import { ReadingCard, rangeStatus, CardSpec } from "./Readings";
import { IndoorDetail, Plant, IndoorWateringEvent, MeasurementCreate } from "../api/types";

const ACCENT = "#7CE38B";
const AMBER = "#FFB000";

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-ES");
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("es-ES");
}

interface DayBucket {
  key: string;
  liters: number;
  ec: number | null;
}

function aggregateByDay(history: IndoorWateringEvent[], days = 14): DayBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: Record<string, { liters: number; ecSum: number; ecCount: number }> = {};
  const order: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { liters: 0, ecSum: 0, ecCount: 0 };
    order.push(key);
  }

  history.forEach((h) => {
    const key = h.event_ts.slice(0, 10);
    if (buckets[key]) {
      buckets[key].liters += h.liters * (h.plants?.length || 1);
      if (h.ec != null) {
        buckets[key].ecSum += h.ec;
        buckets[key].ecCount += 1;
      }
    }
  });

  return order.map((key) => {
    const b = buckets[key];
    return {
      key,
      liters: b.liters,
      ec: b.ecCount ? b.ecSum / b.ecCount : null,
    };
  });
}

function WateringChart({ data }: { data: DayBucket[] }) {
  const W = 560;
  const H = 170;
  const padL = 10;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxLiters = Math.max(1, ...data.map((d) => d.liters));
  const maxEc = Math.max(1, ...data.map((d) => d.ec ?? 0));
  const n = data.length;
  const slot = plotW / n;
  const barW = slot * 0.55;

  const ecPoints = data
    .map((d, i) => {
      if (d.ec == null) return null;
      const x = padL + slot * i + slot / 2;
      const y = padT + plotH - (d.ec / maxEc) * plotH;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padL}
            x2={W - padR}
            y1={padT + plotH * t}
            y2={padT + plotH * t}
            stroke="#2e4a38"
            strokeWidth="1"
          />
        ))}

        {/* liters bars */}
        {data.map((d, i) => {
          const h = (d.liters / maxLiters) * plotH;
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + plotH - h;
          return (
            <rect
              key={d.key}
              x={x}
              y={h > 0 ? y : padT + plotH}
              width={barW}
              height={h}
              fill={ACCENT}
              opacity="0.35"
            />
          );
        })}

        {/* EC line */}
        {ecPoints && (
          <polyline
            points={ecPoints}
            fill="none"
            stroke={AMBER}
            strokeWidth="2"
          />
        )}
        {data.map((d, i) => {
          if (d.ec == null) return null;
          const x = padL + slot * i + slot / 2;
          const y = padT + plotH - (d.ec / maxEc) * plotH;
          return <circle key={d.key} cx={x} cy={y} r="2.5" fill={AMBER} />;
        })}

        {/* x labels */}
        {data.map((d, i) => {
          if (i % 2 !== 0) return null;
          const x = padL + slot * i + slot / 2;
          return (
            <text
              key={d.key}
              x={x}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#93a88d"
              fontFamily="IBM Plex Mono, monospace"
            >
              {d.key.slice(8, 10)}
            </text>
          );
        })}
      </svg>
      <div className="flex gap-4 mt-1 text-[10px] uppercase tracking-widest text-gray-500">
        <span className="flex items-center gap-1">
          <span className="led" style={{ background: ACCENT }} /> Litros
        </span>
        <span className="flex items-center gap-1">
          <span className="led" style={{ background: AMBER }} /> EC prom.
        </span>
      </div>
    </div>
  );
}

interface RiegoPanelProps {
  indoor: IndoorDetail;
  plants: Plant[];
  onUpdated: () => void;
}

export function RiegoPanel({ indoor, plants, onUpdated }: RiegoPanelProps) {
  const { data: history, loading, refetch } = useIndoorWateringHistory(indoor.id);
  const { deleteWateringEvent } = useDeleteWateringEvent();
  const { data: targets } = useStageTargets(indoor.id);
  const { createMeasurement } = useCreateMeasurement();
  const { toasts, showToast, removeToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [open, setOpen] = useState(true);
  const [editEvent, setEditEvent] = useState<IndoorWateringEvent | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<IndoorWateringEvent | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  const env = indoor.current_environment;
  const target = targets?.find((t) => t.stage === indoor.stage) ?? null;

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

  const waterCards: CardSpec[] = [
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
      save: (v) => saveReading("ec", v),
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
      save: (v) => saveReading("ph", v),
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
      save: (v) => saveReading("runoff_ec", v),
    },
  ];

  const chartData = useMemo(
    () => aggregateByDay(history ?? [], 14),
    [history]
  );

  const lastWatering = history && history.length > 0 ? history[0].event_ts : null;

  const nextWater = useMemo(() => {
    const dates = plants
      .map((p) => p.next_water_at)
      .filter((d): d is string => !!d)
      .sort();
    return dates.length ? dates[0] : null;
  }, [plants]);

  const weekLiters = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    return (history ?? [])
      .filter((h) => new Date(h.event_ts).getTime() >= cutoff)
      .reduce((sum, h) => sum + h.liters * (h.plants?.length || 1), 0);
  }, [history]);

  const handleSuccess = () => {
    showToast("Riego registrado", "success");
    refetch();
    onUpdated();
  };

  const handleEventSaved = () => {
    showToast("Riego actualizado", "success");
    refetch();
    onUpdated();
  };

  const handleDelete = async () => {
    if (!deleteEvent) return;
    try {
      await deleteWateringEvent(deleteEvent.group_id);
      showToast("Riego eliminado", "success");
      refetch();
      onUpdated();
    } catch {
      showToast("Error al eliminar el riego", "error");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h3 className="section-title text-lg font-semibold text-gray-800">Agua & Riego</h3>
        </button>
        <button
          onClick={() => setModalOpen(true)}
          disabled={plants.length === 0}
          className="px-5 py-2 rounded-sm text-xs font-medium uppercase tracking-wider bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Regar indoor ({plants.length})
        </button>
      </div>

      {open && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {waterCards.map((card) => (
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
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-gray-50 rounded-sm p-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Último riego</p>
              <p className="text-lg font-bold text-gray-800 mt-1">
                {lastWatering ? fmtDateTime(lastWatering) : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-sm p-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Próximo riego</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{fmtDate(nextWater)}</p>
            </div>
            <div className="bg-gray-50 rounded-sm p-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Litros (7d)</p>
              <p className="text-lg font-bold text-blue-500 mt-1">{weekLiters.toFixed(1)} L</p>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500">Cargando historial...</p>
          ) : history && history.length > 0 ? (
            <>
              <WateringChart data={chartData} />
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                  Cuadro de riegos
                </p>
                <div className="overflow-x-auto overflow-y-auto max-h-72 border border-gray-200 rounded-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Fecha</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Plantas</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Litros</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">EC</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">pH</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Runoff</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Nota</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 50).map((h) => (
                        <tr key={h.group_id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {fmtDateTime(h.event_ts)}
                          </td>
                          <td className="px-3 py-2 text-blue-500">
                            {h.plants.map((p) => p.name).join(", ")}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                            {h.liters}
                            {h.plants.length > 1
                              ? ` (${(h.liters * h.plants.length).toFixed(1)} tot)`
                              : ""}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{h.ec ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{h.ph ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {h.runoff_ec ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-500 max-w-[12rem] truncate">
                            {h.note || "—"}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => setEditEvent(h)}
                              className="text-blue-500 hover:text-blue-700 text-xs"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setDeleteEvent(h)}
                              className="text-red-500 hover:text-red-700 text-xs ml-3"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500">Todavía no hay riegos registrados.</p>
          )}
        </>
      )}

      <WaterIndoorModal
        isOpen={modalOpen}
        indoor={indoor}
        plants={plants}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />

      <WateringEventModal
        isOpen={!!editEvent}
        event={editEvent}
        plants={plants}
        onClose={() => setEditEvent(null)}
        onSuccess={handleEventSaved}
      />

      <ConfirmDialog
        isOpen={!!deleteEvent}
        title="Eliminar riego"
        message={`¿Eliminar el riego del ${deleteEvent ? fmtDate(deleteEvent.event_ts) : ""}? Se borra para todas sus plantas (${deleteEvent?.plants.map((p) => p.name).join(", ") ?? ""}).`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleteEvent(null)}
      />
    </div>
  );
}

interface WateringEventModalProps {
  isOpen: boolean;
  event: IndoorWateringEvent | null;
  plants: Plant[];
  onClose: () => void;
  onSuccess: () => void;
}

function WateringEventModal({
  isOpen,
  event,
  plants,
  onClose,
  onSuccess,
}: WateringEventModalProps) {
  const { updateWateringEvent, loading, error } = useUpdateWateringEvent();
  const [liters, setLiters] = useState("");
  const [unit, setUnit] = useState<"L" | "ml">("L");
  const [ec, setEc] = useState("");
  const [ph, setPh] = useState("");
  const [runoffEc, setRunoffEc] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const switchUnit = (newUnit: "L" | "ml") => {
    const num = parseFloat(liters);
    if (!Number.isNaN(num)) {
      setLiters(String(newUnit === "ml" ? num * 1000 : num / 1000));
    }
    setUnit(newUnit);
  };

  if (isOpen && event && initializedFor !== event.group_id) {
    setLiters(String(event.liters));
    setUnit("L");
    setEc(event.ec != null ? String(event.ec) : "");
    setPh(event.ph != null ? String(event.ph) : "");
    setRunoffEc(event.runoff_ec != null ? String(event.runoff_ec) : "");
    setNote(event.note ?? "");
    setDate(event.event_ts.slice(0, 10));
    setSelectedPlants(event.plants.map((p) => p.id));
    setInitializedFor(event.group_id);
  }

  if (!isOpen || !event) return null;

  const togglePlant = (id: string) => {
    setSelectedPlants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlants.length === 0) {
      alert("Seleccioná al menos una planta");
      return;
    }
    try {
      const raw = parseFloat(liters);
      await updateWateringEvent(event.group_id, {
        liters: unit === "ml" ? raw / 1000 : raw,
        ec: ec !== "" ? parseFloat(ec) : undefined,
        ph: ph !== "" ? parseFloat(ph) : undefined,
        runoff_ec: runoffEc !== "" ? parseFloat(runoffEc) : undefined,
        note,
        date: date || undefined,
        plant_ids: selectedPlants,
      });
      setInitializedFor(null);
      onClose();
      onSuccess();
    } catch {
      // error en estado
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[32rem] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Editar riego</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <label className="field-label">Cantidad *</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step={unit === "ml" ? "1" : "0.1"}
                  min={unit === "ml" ? "1" : "0.01"}
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  required
                />
                <select
                  value={unit}
                  onChange={(e) => switchUnit(e.target.value as "L" | "ml")}
                  className="px-1 py-2 bg-gray-50 border border-gray-300 rounded-sm text-xs text-gray-700"
                >
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">EC</label>
              <input
                type="number"
                step="0.01"
                value={ec}
                onChange={(e) => setEc(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="field-label">pH</label>
              <input
                type="number"
                step="0.01"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="field-label">EC runoff</label>
              <input
                type="number"
                step="0.01"
                value={runoffEc}
                onChange={(e) => setRunoffEc(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="field-label">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="field-label">Plantas ({selectedPlants.length})</label>
            <div className="flex flex-wrap gap-2">
              {plants.map((p) => {
                const checked = selectedPlants.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePlant(p.id)}
                    className={`px-3 py-1 rounded-sm text-xs border ${
                      checked
                        ? "border-blue-500 bg-blue-100 text-blue-800"
                        : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <label className="field-label">Nota</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-gray-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setInitializedFor(null);
                onClose();
              }}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface WaterIndoorModalProps {
  isOpen: boolean;
  indoor: IndoorDetail;
  plants: Plant[];
  onClose: () => void;
  onSuccess: () => void;
}

function WaterIndoorModal({
  isOpen,
  indoor,
  plants,
  onClose,
  onSuccess,
}: WaterIndoorModalProps) {
  const { data: plan } = useFertilizerPlan(indoor.id);
  const { data: catalog } = useFertilizers();
  const { waterIndoor, loading, error } = useWaterIndoor();

  const [liters, setLiters] = useState("2");
  const [unit, setUnit] = useState<"L" | "ml">("L");
  const [ec, setEc] = useState("");
  const [ph, setPh] = useState("");
  const [runoffEc, setRunoffEc] = useState("");
  const [note, setNote] = useState("");
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [selectedFerts, setSelectedFerts] = useState<Record<string, string>>({});
  const [soloAgua, setSoloAgua] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const switchUnit = (newUnit: "L" | "ml") => {
    const num = parseFloat(liters);
    if (!Number.isNaN(num)) {
      setLiters(String(newUnit === "ml" ? num * 1000 : num / 1000));
    }
    setUnit(newUnit);
  };

  if (isOpen && !initialized) {
    setSelectedPlants(plants.map((p) => p.id));
    const defaultLiters = plants.length
      ? String(plants[0].default_liters ?? 2)
      : "2";
    setLiters(defaultLiters);
    setSoloAgua(false);
    setInitialized(true);
  }

  if (!isOpen) return null;

  const activeFerts = (plan ?? []).filter((p) => p.active);
  const fertOptions = activeFerts.length
    ? activeFerts.map((f) => ({
        id: f.fertilizer_id,
        name: f.fertilizer_name,
        default_amount: f.default_amount,
      }))
    : (catalog ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        default_amount: f.default_amount,
      }));

  const togglePlant = (id: string) => {
    setSelectedPlants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleFert = (id: string) => {
    setSelectedFerts((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else {
        const item = fertOptions.find((f) => f.id === id);
        next[id] = item?.default_amount != null ? String(item.default_amount) : "";
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = parseFloat(liters);
    const litersNum = unit === "ml" ? raw / 1000 : raw;
    if (!litersNum || litersNum <= 0) {
      alert("Ingresá una cantidad válida");
      return;
    }
    if (selectedPlants.length === 0) {
      alert("Seleccioná al menos una planta");
      return;
    }
    if (!soloAgua && Object.keys(selectedFerts).length === 0) {
      alert("Indicá al menos un fertilizante con su dosis, o marcá 'Solo agua'");
      return;
    }

    try {
      await waterIndoor(indoor.id, {
        liters: litersNum,
        ec: ec !== "" ? parseFloat(ec) : undefined,
        ph: ph !== "" ? parseFloat(ph) : undefined,
        runoff_ec: runoffEc !== "" ? parseFloat(runoffEc) : undefined,
        note: note || undefined,
        plant_ids: selectedPlants,
        fertilizers: soloAgua
          ? []
          : Object.entries(selectedFerts).map(([fertilizer_id, dose]) => ({
              fertilizer_id,
              amount: dose !== "" ? parseFloat(dose) : undefined,
            })),
      });
      setInitialized(false);
      setEc("");
      setPh("");
      setRunoffEc("");
      setNote("");
      setSelectedFerts({});
      setSoloAgua(false);
      onClose();
      onSuccess();
    } catch {
      // error in state
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[32rem] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Regar indoor: {indoor.name}</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <label className="field-label">Cantidad *</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step={unit === "ml" ? "1" : "0.1"}
                  min={unit === "ml" ? "1" : "0.01"}
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
                <select
                  value={unit}
                  onChange={(e) => switchUnit(e.target.value as "L" | "ml")}
                  className="px-1 py-2 bg-gray-50 border border-gray-300 rounded-sm text-xs text-gray-700"
                >
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">EC</label>
              <input
                type="number"
                step="0.01"
                value={ec}
                onChange={(e) => setEc(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="field-label">pH</label>
              <input
                type="number"
                step="0.01"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="field-label">EC runoff</label>
              <input
                type="number"
                step="0.01"
                value={runoffEc}
                onChange={(e) => setRunoffEc(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Plants */}
          <div className="mb-4">
            <label className="field-label">
              Plantas ({selectedPlants.length}/{plants.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {plants.map((p) => {
                const checked = selectedPlants.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePlant(p.id)}
                    className={`px-3 py-1 rounded-sm text-xs border ${
                      checked
                        ? "border-blue-500 bg-blue-100 text-blue-800"
                        : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fertilizers */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="field-label mb-0">Fertilizantes (ml/L) *</label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soloAgua}
                  onChange={(e) => setSoloAgua(e.target.checked)}
                  className="w-4 h-4"
                />
                Solo agua (flush)
              </label>
            </div>
            {fertOptions.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay fertilizantes en el catálogo. Agregalos en la sección Fertilizantes.
              </p>
            ) : (
              <div
                className={`space-y-2 ${soloAgua ? "opacity-40 pointer-events-none" : ""}`}
              >
                {fertOptions.map((f) => {
                  const checked = f.id in selectedFerts;
                  return (
                    <div key={f.id} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFert(f.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-800">{f.name}</span>
                      </label>
                      {checked && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={selectedFerts[f.id]}
                            onChange={(e) =>
                              setSelectedFerts((prev) => ({
                                ...prev,
                                [f.id]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="w-20 px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-xs text-gray-500">ml/L</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="field-label">Nota (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setInitialized(false);
                onClose();
              }}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              {loading ? "Regando..." : `Regar ${selectedPlants.length} planta(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

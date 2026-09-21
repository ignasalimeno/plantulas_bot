import { useState } from "react";
import {
  useStages,
  useStageTargets,
  useUpdateStageTargets,
  useUpdateIndoor,
  useMeasurements,
  useCreateMeasurement,
  useDeleteMeasurement,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { Chevron } from "./Collapsible";
import { IndoorDetail, StageTarget, Task } from "../api/types";

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Diario",
  weekly: "Semanal",
  every_2_3_days: "Cada 2-3 días",
};

function useStageLabels() {
  const { data } = useStages();
  const map: Record<string, string> = {};
  data?.forEach((s) => {
    map[s.key] = s.label;
  });
  return map;
}

function fmt(value: number | null | undefined, suffix = "") {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

/**
 * Panel de etapa actual: selector + target de EC/pH de la etapa.
 */
function IdealValue({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-gray-500">{label}</span>
      <span
        className="text-lg font-bold text-blue-500 leading-none"
        style={{ textShadow: "0 0 12px rgba(124,227,139,0.4)" }}
      >
        {value}
      </span>
      {unit && <span className="text-[10px] text-gray-500">{unit}</span>}
    </div>
  );
}

/**
 * Panel de etapa: selector + valores ideales de la etapa (fila horizontal).
 */
export function StagePanel({
  indoor,
  onUpdated,
}: {
  indoor: IndoorDetail;
  onUpdated: () => void;
}) {
  const { data: stages } = useStages();
  const { data: targets } = useStageTargets(indoor.id);
  const { updateIndoor, loading } = useUpdateIndoor();
  const [open, setOpen] = useState(true);

  const currentTarget = targets?.find((t) => t.stage === indoor.stage);

  const handleChange = async (stage: string) => {
    await updateIndoor(indoor.id, { stage });
    onUpdated();
  };

  const daysInStage = indoor.stage_started_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(indoor.stage_started_at + "T00:00:00").getTime()) /
            86400000
        )
      )
    : null;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <span className="section-title text-sm font-semibold text-gray-800">Etapa</span>
        </button>

        <select
          value={indoor.stage}
          onChange={(e) => handleChange(e.target.value)}
          disabled={loading}
          className="min-w-[11rem] px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          {stages?.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        {open && currentTarget && (
          <>
            <IdealValue
              label="EC"
              value={`${fmt(currentTarget.ec_min)}–${fmt(currentTarget.ec_max)}`}
              unit="mS/cm"
            />
            <IdealValue
              label="pH"
              value={`${fmt(currentTarget.ph_min)}–${fmt(currentTarget.ph_max)}`}
            />
            <IdealValue
              label="Temp"
              value={`${fmt(currentTarget.temp_min)}–${fmt(currentTarget.temp_max)}`}
              unit="°C"
            />
            <IdealValue
              label="HR"
              value={`${fmt(currentTarget.humidity_min)}–${fmt(currentTarget.humidity_max)}`}
              unit="%"
            />
            <IdealValue
              label="Luz"
              value={`${fmt(currentTarget.light_height_min)}–${fmt(currentTarget.light_height_max)}`}
              unit="cm"
            />
            <IdealValue
              label="PPFD"
              value={`${fmt(currentTarget.ppfd_min)}–${fmt(currentTarget.ppfd_max)}`}
            />
            <IdealValue label="Horario" value={currentTarget.light_schedule || "—"} />
          </>
        )}

        <span className="ml-auto text-[10px] uppercase tracking-widest text-gray-500">
          {daysInStage != null && `día ${daysInStage + 1} · `}inicio{" "}
          {indoor.stage_started_at || "—"}
        </span>
      </div>
    </div>
  );
}

const TARGET_FIELDS: Array<{
  label: string;
  min: keyof StageTarget;
  max: keyof StageTarget;
  unit?: string;
  step: string;
}> = [
  { label: "EC", min: "ec_min", max: "ec_max", unit: "mS/cm", step: "0.01" },
  { label: "pH", min: "ph_min", max: "ph_max", step: "0.01" },
  { label: "Temperatura", min: "temp_min", max: "temp_max", unit: "°C", step: "0.1" },
  { label: "Humedad", min: "humidity_min", max: "humidity_max", unit: "%", step: "1" },
  { label: "Altura luz", min: "light_height_min", max: "light_height_max", unit: "cm", step: "1" },
  { label: "PPFD", min: "ppfd_min", max: "ppfd_max", step: "1" },
];

function StageTargetCard({
  target,
  label,
  editMode,
  current,
  onChange,
}: {
  target: StageTarget;
  label: string;
  editMode: boolean;
  current: boolean;
  onChange: (stage: string, field: keyof StageTarget, value: string, isText?: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(current);

  return (
    <div
      className={`border rounded-sm ${current ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <Chevron open={expanded} />
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          {current && (
            <span className="text-[10px] uppercase tracking-widest text-blue-500">actual</span>
          )}
        </span>
        <span className="text-xs text-gray-500">
          EC {fmt(target.ec_min)}–{fmt(target.ec_max)} · pH {fmt(target.ph_min)}–
          {fmt(target.ph_max)}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TARGET_FIELDS.map((g) => (
              <div key={g.label}>
                <p className="field-label">
                  {g.label}
                  {g.unit ? ` (${g.unit})` : ""}
                </p>
                {editMode ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={g.step}
                      value={(target[g.min] as number | null) ?? ""}
                      onChange={(e) => onChange(target.stage, g.min, e.target.value)}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-gray-500">–</span>
                    <input
                      type="number"
                      step={g.step}
                      value={(target[g.max] as number | null) ?? ""}
                      onChange={(e) => onChange(target.stage, g.max, e.target.value)}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <p className="text-gray-800">
                    {fmt(target[g.min] as number | null)} – {fmt(target[g.max] as number | null)}
                  </p>
                )}
              </div>
            ))}

            <div>
              <p className="field-label">Horario luz</p>
              {editMode ? (
                <input
                  type="text"
                  value={target.light_schedule ?? ""}
                  onChange={(e) =>
                    onChange(target.stage, "light_schedule", e.target.value, true)
                  }
                  placeholder="18/6"
                  className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                />
              ) : (
                <p className="text-gray-800">{target.light_schedule || "—"}</p>
              )}
            </div>

            <div className="col-span-2 md:col-span-3">
              <p className="field-label">Notas</p>
              {editMode ? (
                <input
                  type="text"
                  value={target.notes ?? ""}
                  onChange={(e) => onChange(target.stage, "notes", e.target.value, true)}
                  className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                />
              ) : (
                <p className="text-gray-600 text-sm">{target.notes || "—"}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Objetivos por etapa: tarjetas colapsables con todos los rangos.
 */
export function StageTargetsPanel({
  indoorId,
  currentStage,
}: {
  indoorId: string;
  currentStage: string;
}) {
  const { data: stages } = useStages();
  const { data, loading, refetch } = useStageTargets(indoorId);
  const { updateTargets, loading: saving } = useUpdateStageTargets();
  const { toasts, showToast, removeToast } = useToast();

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, StageTarget>>({});
  const [open, setOpen] = useState(true);

  const stageLabel = (key: string) => stages?.find((s) => s.key === key)?.label ?? key;

  const startEdit = () => {
    const copy: Record<string, StageTarget> = {};
    data?.forEach((t) => {
      copy[t.stage] = { ...t };
    });
    setDraft(copy);
    setEditMode(true);
  };

  const handleChange = (
    stage: string,
    field: keyof StageTarget,
    value: string,
    isText = false
  ) => {
    setDraft((prev) => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        [field]: isText ? (value === "" ? null : value) : value === "" ? null : Number(value),
      },
    }));
  };

  const handleSave = async () => {
    try {
      const targets = Object.values(draft);
      await updateTargets(indoorId, { targets });
      showToast("Objetivos guardados", "success");
      setEditMode(false);
      refetch();
    } catch {
      showToast("Error al guardar objetivos", "error");
    }
  };

  if (loading) return <p className="text-gray-500">Cargando objetivos...</p>;
  if (!data || data.length === 0)
    return <p className="text-gray-500">No hay objetivos definidos.</p>;

  const rows = editMode ? data.map((t) => draft[t.stage] ?? t) : data;

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
            Objetivos por etapa
          </h3>
        </button>
        {editMode ? (
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(false)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Editar
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-2">
          {rows.map((t) => (
            <StageTargetCard
              key={t.stage}
              target={t}
              label={stageLabel(t.stage)}
              editMode={editMode}
              current={t.stage === currentStage}
              onChange={handleChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Panel de mediciones (temp, humedad, pH, EC, runoff).
 */
export function MeasurementsPanel({ indoorId }: { indoorId: string }) {
  const { data, loading, refetch } = useMeasurements(indoorId);
  const { createMeasurement, loading: creating } = useCreateMeasurement();
  const { deleteMeasurement } = useDeleteMeasurement();
  const { toasts, showToast, removeToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = (v: string) => (v === "" ? null : Number(v));
    try {
      await createMeasurement(indoorId, {
        temp_c: num(form.temp_c),
        humidity: num(form.humidity),
        ph: num(form.ph),
        ec: num(form.ec),
        runoff_ec: num(form.runoff_ec),
        ppfd: form.ppfd === "" || form.ppfd === undefined ? null : parseInt(form.ppfd),
        note: form.note || null,
      });
      setForm({});
      setShowForm(false);
      showToast("Medición registrada", "success");
      refetch();
    } catch {
      showToast("Error al registrar medición", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMeasurement(id);
      showToast("Medición eliminada", "success");
      refetch();
    } catch {
      showToast("Error al eliminar", "error");
    }
  };

  const fields: Array<{ key: string; label: string }> = [
    { key: "temp_c", label: "Temp (°C)" },
    { key: "humidity", label: "Humedad (%)" },
    { key: "ph", label: "pH" },
    { key: "ec", label: "EC" },
    { key: "runoff_ec", label: "EC runoff" },
    { key: "ppfd", label: "PPFD" },
  ];

  const fmtDate = (s: string) => new Date(s).toLocaleString("es-ES");

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h3 className="section-title text-lg font-semibold text-gray-800">Mediciones</h3>
        </button>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          {showForm ? "Cancelar" : "+ Nueva medición"}
        </button>
      </div>

      {open && (
        <>
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-5 gap-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {f.label}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <input
              type="text"
              placeholder="Nota (opcional)"
              value={form.note ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
          >
            {creating ? "Guardando..." : "Guardar medición"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : data && data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Fecha</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Temp</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">HR</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">pH</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">EC</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Runoff</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">PPFD</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Nota</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{fmtDate(m.event_ts)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmt(m.temp_c)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmt(m.humidity)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmt(m.ph)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmt(m.ec)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmt(m.runoff_ec)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmt(m.ppfd)}</td>
                  <td className="px-4 py-2 text-gray-600">{m.note || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No hay mediciones registradas.</p>
      )}
        </>
      )}
    </div>
  );
}

/**
 * Panel de checklist de tareas por etapa.
 */
export function ChecklistPanel({
  indoorId,
  currentStage,
}: {
  indoorId: string;
  currentStage: string;
}) {
  const { data, loading, refetch } = useTasks(indoorId);
  const { createTask, loading: creating } = useCreateTask();
  const { updateTask } = useUpdateTask();
  const { deleteTask } = useDeleteTask();
  const { toasts, showToast, removeToast } = useToast();

  const stageLabel = useStageLabels();
  const [showAll, setShowAll] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFrequency, setNewFrequency] = useState("daily");
  const [open, setOpen] = useState(true);

  const relevant = (t: Task) => !t.stage || t.stage === currentStage;
  const visible = (data ?? []).filter((t) => showAll || relevant(t));

  const handleToggle = async (task: Task) => {
    await updateTask(task.id, { is_done: !task.is_done });
    refetch();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await createTask(indoorId, {
        title: newTitle.trim(),
        frequency: newFrequency,
        stage: null,
      });
      setNewTitle("");
      showToast("Tarea añadida", "success");
      refetch();
    } catch {
      showToast("Error al añadir tarea", "error");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    refetch();
  };

  if (loading) return <p className="text-gray-500">Cargando checklist...</p>;

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
            Checklist de monitoreo
          </h3>
        </button>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-sm text-blue-500 hover:text-blue-700"
        >
          {showAll ? "Mostrar solo etapa actual" : "Mostrar todas"}
        </button>
      </div>

      {open && (
        <>
      {visible.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {visible.map((t) => (
            <li
              key={t.id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                t.is_done ? "bg-green-50" : "bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={t.is_done}
                onChange={() => handleToggle(t)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <span
                  className={`text-gray-800 ${t.is_done ? "line-through text-gray-400" : ""}`}
                >
                  {t.title}
                </span>
                <div className="flex gap-2 text-xs text-gray-500 mt-1">
                  {t.frequency && <span>{FREQUENCY_LABELS[t.frequency] ?? t.frequency}</span>}
                  {t.stage && <span>· {stageLabel[t.stage] ?? t.stage}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 mb-4">No hay tareas para esta etapa.</p>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          placeholder="Nueva tarea..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={newFrequency}
          onChange={(e) => setNewFrequency(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="daily">Diario</option>
          <option value="every_2_3_days">Cada 2-3 días</option>
          <option value="weekly">Semanal</option>
        </select>
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
        >
          Añadir
        </button>
      </form>
        </>
      )}
    </div>
  );
}

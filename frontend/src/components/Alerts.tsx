import { useEffect, useState } from "react";
import {
  useAlerts,
  useDeleteAlert,
  useAcknowledgeAlert,
  useAlertRules,
  useCreateAlertRule,
  useDeleteAlertRule,
  useWateringPlan,
  useUpdateWateringPlan,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { AlertKind, AlertRuleCreate } from "../api/types";

const KIND_LABELS: Record<string, string> = {
  temp_out_of_range: "Temperatura fuera de rango",
  humidity_below: "Humedad baja sostenida",
  watering_overdue: "Riego atrasado",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ruleSummary(kind: string, min: number | null, max: number | null, duration: number | null, tolerance: number | null) {
  if (kind === "humidity_below") {
    return `HR < ${min ?? "?"}% durante ${duration ?? 30} min`;
  }
  if (kind === "temp_out_of_range") {
    return `Temp fuera de ${min ?? "?"}–${max ?? "?"}°C durante ${duration ?? 30} min`;
  }
  if (kind === "watering_overdue") {
    return `Sin riego según el plan (+${tolerance ?? 0} día/s de tolerancia)`;
  }
  return kind;
}

export function AlertsModal({
  indoorId,
  onClose,
}: {
  indoorId: string;
  onClose: () => void;
}) {
  const { data: alerts, refetch: refetchAlerts } = useAlerts(indoorId);
  const { deleteAlert } = useDeleteAlert();
  const { acknowledge } = useAcknowledgeAlert();
  const { data: rules, refetch: refetchRules } = useAlertRules(indoorId);
  const { createRule } = useCreateAlertRule();
  const { deleteRule } = useDeleteAlertRule();
  const { data: plan, refetch: refetchPlan } = useWateringPlan(indoorId);
  const { updatePlan } = useUpdateWateringPlan();
  const { toasts, showToast, removeToast } = useToast();

  // Watering plan form
  const [planForm, setPlanForm] = useState({
    enabled: false,
    mode: "interval_days" as "interval_days" | "times_per_day",
    interval_days: "",
    times_per_day: "",
    amount: "",
    unit: "L",
  });

  useEffect(() => {
    if (plan) {
      setPlanForm({
        enabled: plan.enabled,
        mode: plan.mode,
        interval_days: plan.interval_days != null ? String(plan.interval_days) : "",
        times_per_day: plan.times_per_day != null ? String(plan.times_per_day) : "",
        amount: plan.amount != null ? String(plan.amount) : "",
        unit: plan.unit ?? "L",
      });
    }
  }, [plan]);

  // New rule form
  const [newKind, setNewKind] = useState<AlertKind>("humidity_below");
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newTolerance, setNewTolerance] = useState("0");

  const handleSavePlan = async () => {
    try {
      await updatePlan(indoorId, {
        enabled: planForm.enabled,
        mode: planForm.mode,
        interval_days:
          planForm.mode === "interval_days" && planForm.interval_days !== ""
            ? parseInt(planForm.interval_days)
            : null,
        times_per_day:
          planForm.mode === "times_per_day" && planForm.times_per_day !== ""
            ? parseInt(planForm.times_per_day)
            : null,
        amount: planForm.amount !== "" ? parseFloat(planForm.amount) : null,
        unit: planForm.unit,
      });
      showToast("Plan guardado", "success");
      refetchPlan();
    } catch {
      showToast("Error al guardar el plan", "error");
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: AlertRuleCreate = { kind: newKind, enabled: true };
    if (newKind === "humidity_below") {
      payload.min_value = newMin !== "" ? parseFloat(newMin) : null;
      payload.duration_minutes = newDuration !== "" ? parseInt(newDuration) : 30;
    } else if (newKind === "temp_out_of_range") {
      payload.min_value = newMin !== "" ? parseFloat(newMin) : null;
      payload.max_value = newMax !== "" ? parseFloat(newMax) : null;
      payload.duration_minutes = newDuration !== "" ? parseInt(newDuration) : 30;
    } else {
      payload.tolerance_days = newTolerance !== "" ? parseInt(newTolerance) : 0;
    }
    try {
      await createRule(indoorId, payload);
      showToast("Regla creada", "success");
      setNewMin("");
      setNewMax("");
      refetchRules();
      refetchAlerts();
    } catch {
      showToast("Error al crear la regla", "error");
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule(id);
      refetchRules();
      refetchAlerts();
    } catch {
      showToast("Error al eliminar la regla", "error");
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteAlert(id);
      refetchAlerts();
    } catch {
      showToast("Error al eliminar la alerta", "error");
    }
  };

  const handleAck = async (id: string) => {
    try {
      await acknowledge(id, true);
      refetchAlerts();
    } catch {
      showToast("Error al reconocer la alerta", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-[min(94vw,720px)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Alertas</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-sm px-1">
            ✕
          </button>
        </div>

        {/* Active alerts */}
        <section className="mb-6">
          <p className="field-label">Alertas activas</p>
          {alerts && alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start justify-between gap-3 rounded-sm px-3 py-2 border ${
                    a.acknowledged
                      ? "border-gray-200 bg-gray-50"
                      : "border-yellow-500 bg-yellow-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{a.message}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-0.5">
                      {KIND_LABELS[a.kind] ?? a.kind} · {fmtDateTime(a.triggered_at)}
                      {a.acknowledged ? " · reconocida" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!a.acknowledged && (
                      <button
                        onClick={() => handleAck(a.id)}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                      >
                        Reconocer
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAlert(a.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay alertas activas. Todo en orden ✓</p>
          )}
        </section>

        {/* Watering plan */}
        <section className="mb-6 border-t border-gray-200 pt-4">
          <p className="field-label">Plan de riego</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={planForm.enabled}
                onChange={(e) => setPlanForm((p) => ({ ...p, enabled: e.target.checked }))}
              />
              Activo
            </label>
            <select
              value={planForm.mode}
              onChange={(e) =>
                setPlanForm((p) => ({ ...p, mode: e.target.value as "interval_days" | "times_per_day" }))
              }
              className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800"
            >
              <option value="interval_days">Cada N días</option>
              <option value="times_per_day">N veces por día</option>
            </select>
            {planForm.mode === "interval_days" ? (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Cada
                <input
                  type="number"
                  min="1"
                  value={planForm.interval_days}
                  onChange={(e) => setPlanForm((p) => ({ ...p, interval_days: e.target.value }))}
                  className="w-16 px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm"
                />
                días
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="number"
                  min="1"
                  value={planForm.times_per_day}
                  onChange={(e) => setPlanForm((p) => ({ ...p, times_per_day: e.target.value }))}
                  className="w-16 px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm"
                />
                veces/día
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Cantidad
              <input
                type="number"
                step="0.01"
                value={planForm.amount}
                onChange={(e) => setPlanForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-20 px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm"
              />
              <select
                value={planForm.unit}
                onChange={(e) => setPlanForm((p) => ({ ...p, unit: e.target.value }))}
                className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-sm"
              >
                <option value="L">L</option>
                <option value="ml">ml</option>
              </select>
            </label>
            <button
              onClick={handleSavePlan}
              className="px-3 py-1 text-xs uppercase tracking-wider bg-blue-500 text-white rounded-sm hover:bg-blue-600"
            >
              Guardar plan
            </button>
          </div>
        </section>

        {/* Rules */}
        <section className="border-t border-gray-200 pt-4">
          <p className="field-label">Reglas de alerta</p>
          {rules && rules.length > 0 ? (
            <div className="space-y-2 mb-4">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 bg-gray-50 rounded-sm px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-gray-800">{KIND_LABELS[r.kind] ?? r.kind}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">
                      {ruleSummary(r.kind, r.min_value, r.max_value, r.duration_minutes, r.tolerance_days)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(r.id)}
                    className="text-red-500 hover:text-red-700 text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">No hay reglas definidas.</p>
          )}

          <form onSubmit={handleAddRule} className="flex flex-wrap items-end gap-2 bg-gray-50 rounded-sm p-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as AlertKind)}
                className="px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm text-gray-800"
              >
                <option value="humidity_below">Humedad baja sostenida</option>
                <option value="temp_out_of_range">Temperatura fuera de rango</option>
                <option value="watering_overdue">Riego atrasado</option>
              </select>
            </div>

            {newKind === "humidity_below" && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">HR mín (%)</label>
                  <input
                    type="number"
                    value={newMin}
                    onChange={(e) => setNewMin(e.target.value)}
                    className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duración (min)</label>
                  <input
                    type="number"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm"
                  />
                </div>
              </>
            )}

            {newKind === "temp_out_of_range" && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Temp mín (°C)</label>
                  <input
                    type="number"
                    value={newMin}
                    onChange={(e) => setNewMin(e.target.value)}
                    className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Temp máx (°C)</label>
                  <input
                    type="number"
                    value={newMax}
                    onChange={(e) => setNewMax(e.target.value)}
                    className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duración (min)</label>
                  <input
                    type="number"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm"
                  />
                </div>
              </>
            )}

            {newKind === "watering_overdue" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tolerancia (días)</label>
                <input
                  type="number"
                  value={newTolerance}
                  onChange={(e) => setNewTolerance(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              className="px-3 py-1 text-xs uppercase tracking-wider bg-blue-500 text-white rounded-sm hover:bg-blue-600"
            >
              Agregar regla
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

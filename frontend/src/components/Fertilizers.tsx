import { useState } from "react";
import {
  useFertilizers,
  useCreateFertilizer,
  useDeleteFertilizer,
  useFertilizerPlan,
  useUpdateFertilizerPlan,
  useFertilizerApplications,
  useCreateFertilizerApplication,
  useDeleteFertilizerApplication,
  useStages,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { Chevron } from "./Collapsible";
import { PlanItemInput } from "../api/types";

const KIND_OPTIONS = [
  { value: "base", label: "Base A+B" },
  { value: "calmag", label: "Cal-Mag" },
  { value: "pk", label: "PK / Booster" },
  { value: "root", label: "Enraizante" },
  { value: "enzyme", label: "Enzimas" },
  { value: "other", label: "Otro" },
];

const FREQUENCY_OPTIONS = [
  { value: "every_watering", label: "Cada riego" },
  { value: "weekly", label: "Semanal" },
  { value: "stage", label: "Por etapa" },
];

function kindLabel(kind: string | null) {
  return KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind ?? "—";
}

function freqLabel(freq: string | null) {
  return FREQUENCY_OPTIONS.find((f) => f.value === freq)?.label ?? freq ?? "—";
}

function fmtDate(s: string | null) {
  if (!s) return "nunca";
  return new Date(s).toLocaleDateString("es-ES");
}

export function FertilizersPanel({
  indoorId,
  currentStage,
}: {
  indoorId: string;
  currentStage: string;
}) {
  const { data: catalog, loading: catalogLoading, refetch: refetchCatalog } = useFertilizers();
  const { data: plan, loading: planLoading, refetch: refetchPlan } = useFertilizerPlan(indoorId);
  const { data: applications, refetch: refetchApps } = useFertilizerApplications(indoorId);
  const { data: stages } = useStages();

  const { createFertilizer, loading: creatingFert } = useCreateFertilizer();
  const { deleteFertilizer } = useDeleteFertilizer();
  const { updatePlan, loading: savingPlan } = useUpdateFertilizerPlan();
  const { createApplication } = useCreateFertilizerApplication();
  const { deleteApplication } = useDeleteFertilizerApplication();
  const { toasts, showToast, removeToast } = useToast();

  const [editingPlan, setEditingPlan] = useState(false);
  const [draft, setDraft] = useState<Record<string, { frequency: string; stage: string }>>({});
  const [newFert, setNewFert] = useState({
    name: "",
    kind: "base",
    default_amount: "",
  });
  const [applyAmounts, setApplyAmounts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);

  const stageLabel = (key: string | null) =>
    key ? stages?.find((s) => s.key === key)?.label ?? key : "Todas";

  const startEditPlan = () => {
    const d: Record<string, { frequency: string; stage: string }> = {};
    (plan ?? []).forEach((p) => {
      d[p.fertilizer_id] = { frequency: p.frequency ?? "every_watering", stage: p.stage ?? "" };
    });
    setDraft(d);
    setEditingPlan(true);
  };

  const toggleDraft = (fertilizerId: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (fertilizerId in next) delete next[fertilizerId];
      else next[fertilizerId] = { frequency: "every_watering", stage: "" };
      return next;
    });
  };

  const handleSavePlan = async () => {
    try {
      const items: PlanItemInput[] = Object.entries(draft).map(([fertilizer_id, v]) => ({
        fertilizer_id,
        frequency: v.frequency,
        stage: v.stage || null,
        active: true,
      }));
      await updatePlan(indoorId, items);
      showToast("Plan guardado", "success");
      setEditingPlan(false);
      refetchPlan();
    } catch {
      showToast("Error al guardar el plan", "error");
    }
  };

  const handleCreateFert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFert.name.trim()) return;
    try {
      await createFertilizer({
        name: newFert.name.trim(),
        kind: newFert.kind,
        unit: "ml/L",
        default_amount: newFert.default_amount !== "" ? parseFloat(newFert.default_amount) : null,
      });
      setNewFert({ name: "", kind: "base", default_amount: "" });
      showToast("Fertilizante agregado", "success");
      refetchCatalog();
    } catch {
      showToast("Error al crear fertilizante", "error");
    }
  };

  const handleDeleteFert = async (id: string) => {
    await deleteFertilizer(id);
    refetchCatalog();
    refetchPlan();
  };

  const handleApply = async (fertilizerId: string, defaultAmount: number | null) => {
    const raw = applyAmounts[fertilizerId];
    const amount = raw !== undefined && raw !== "" ? parseFloat(raw) : defaultAmount;
    try {
      await createApplication(indoorId, { fertilizer_id: fertilizerId, amount });
      showToast("Aplicación registrada", "success");
      refetchApps();
      refetchPlan();
    } catch {
      showToast("Error al registrar aplicación", "error");
    }
  };

  const handleDeleteApplication = async (id: string) => {
    await deleteApplication(id);
    refetchApps();
    refetchPlan();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h3 className="section-title text-lg font-semibold text-gray-800">Fertilizantes</h3>
        </button>
        {editingPlan ? (
          <div className="flex gap-2">
            <button
              onClick={() => setEditingPlan(false)}
              className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleSavePlan}
              disabled={savingPlan}
              className="px-3 py-1 text-xs uppercase tracking-wider bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {savingPlan ? "Guardando..." : "Guardar plan"}
            </button>
          </div>
        ) : (
          <button
            onClick={startEditPlan}
            className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
          >
            Editar plan
          </button>
        )}
      </div>

      {open && (
        <>
      {/* Plan / Mark applied */}
      {editingPlan ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
            Seleccioná los fertis del plan
          </p>
          {catalogLoading ? (
            <p className="text-gray-500">Cargando catálogo...</p>
          ) : catalog && catalog.length > 0 ? (
            <div className="space-y-2">
              {catalog.map((f) => {
                const included = f.id in draft;
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggleDraft(f.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-800">{f.name}</span>
                      <span className="text-xs text-gray-500">{kindLabel(f.kind)}</span>
                    </label>
                    {included && (
                      <>
                        <select
                          value={draft[f.id].frequency}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [f.id]: { ...prev[f.id], frequency: e.target.value },
                            }))
                          }
                          className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-xs text-gray-800"
                        >
                          {FREQUENCY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft[f.id].stage}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [f.id]: { ...prev[f.id], stage: e.target.value },
                            }))
                          }
                          className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-xs text-gray-800"
                        >
                          <option value="">Todas las etapas</option>
                          {stages?.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No hay fertilizantes en el catálogo.</p>
          )}
        </div>
      ) : planLoading ? (
        <p className="text-gray-500">Cargando plan...</p>
      ) : plan && plan.length > 0 ? (
        <div className="mb-6 space-y-2">
          {plan.map((item) => {
            const active = item.active && (!item.stage || item.stage === currentStage);
            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center gap-3 p-3 rounded-sm border ${
                  active ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex-1 min-w-[10rem]">
                  <div className="text-sm text-gray-800 font-medium">
                    {item.fertilizer_name}
                    <span className="ml-2 text-xs text-gray-500">{kindLabel(item.kind)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {freqLabel(item.frequency)}
                    {item.stage ? ` · ${stageLabel(item.stage)}` : " · todas las etapas"}
                    {" · último: "}
                    {fmtDate(item.last_applied_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    placeholder={item.default_amount != null ? String(item.default_amount) : "0"}
                    value={applyAmounts[item.fertilizer_id] ?? ""}
                    onChange={(e) =>
                      setApplyAmounts((prev) => ({
                        ...prev,
                        [item.fertilizer_id]: e.target.value,
                      }))
                    }
                    className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">ml/L</span>
                </div>
                <button
                  onClick={() => handleApply(item.fertilizer_id, item.default_amount)}
                  className="px-3 py-1 text-xs uppercase tracking-wider bg-blue-500 text-white rounded-sm hover:bg-blue-600"
                >
                  Marcar aplicado
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 mb-6">
          No hay plan de fertilizantes. Agregá fertis al catálogo y editá el plan.
        </p>
      )}

      {/* Catalog */}
      <div className="border-t border-gray-200 pt-4 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
          Catálogo de fertilizantes
        </p>
        {catalog && catalog.length > 0 ? (
          <div className="space-y-1 mb-3">
            {catalog.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between text-sm bg-gray-50 rounded-sm px-3 py-2"
              >
                <span className="text-gray-800">
                  {f.name}
                  <span className="ml-2 text-xs text-gray-500">
                    {kindLabel(f.kind)}
                    {f.default_amount != null ? ` · ${f.default_amount} ml/L` : ""}
                  </span>
                </span>
                <button
                  onClick={() => handleDeleteFert(f.id)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm mb-3">Catálogo vacío.</p>
        )}

        <form onSubmit={handleCreateFert} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nombre (ej: Canna Coco A+B)"
            value={newFert.name}
            onChange={(e) => setNewFert((p) => ({ ...p, name: e.target.value }))}
            className="flex-1 min-w-[10rem] px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
          />
          <select
            value={newFert.kind}
            onChange={(e) => setNewFert((p) => ({ ...p, kind: e.target.value }))}
            className="px-2 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="ml/L"
            value={newFert.default_amount}
            onChange={(e) => setNewFert((p) => ({ ...p, default_amount: e.target.value }))}
            className="w-24 px-2 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creatingFert}
            className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 text-xs uppercase tracking-wider"
          >
            Agregar
          </button>
        </form>
      </div>

      {/* Recent applications */}
      {applications && applications.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
            Aplicaciones recientes
          </p>
          <div className="space-y-1 max-h-48 overflow-auto">
            {applications.slice(0, 12).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm bg-gray-50 rounded-sm px-3 py-2"
              >
                <span className="text-gray-800">
                  <span className="text-blue-500">{a.fertilizer_name}</span>
                  {a.amount != null && <span className="text-gray-500"> · {a.amount} ml/L</span>}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">
                    {new Date(a.applied_at).toLocaleDateString("es-ES")}
                  </span>
                  <button
                    onClick={() => handleDeleteApplication(a.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

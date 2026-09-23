import { useState, ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useIndoorDetail,
  useDeletePlant,
  useToast,
} from "../hooks";
import {
  WaterModal,
  ToastContainer,
  EmptyState,
  CreatePlantModal,
  EditPlantModal,
  PlantHistoryModal,
  ConfirmDialog,
} from "../components/Modals";
import {
  StagePanel,
  StageTargetsPanel,
  ChecklistPanel,
} from "../components/Grow";
import { RiegoPanel } from "../components/Riego";
import { FertilizersPanel } from "../components/Fertilizers";
import { AmbientePanel } from "../components/Ambiente";
import { DevicesPanel } from "../components/Devices";
import { HistoryPanel } from "../components/History";
import { CollapsiblePanel } from "../components/Collapsible";
import { PlantDetail, Plant } from "../api/types";

function ZoneLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[10px] uppercase tracking-widest text-gray-500">{children}</span>
      <span className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

export default function IndoorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useIndoorDetail(id || "");
  const { deletePlant } = useDeletePlant();
  const { toasts, showToast, removeToast } = useToast();

  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [createPlantModalOpen, setCreatePlantModalOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<{ id: string; name: string } | null>(null);
  const [editPlant, setEditPlant] = useState<PlantDetail | null>(null);
  const [historyPlant, setHistoryPlant] = useState<PlantDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlantDetail | null>(null);

  if (!id) {
    return <div>ID de indoor no encontrado</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error al cargar detalle: {error.message}
      </div>
    );
  }

  if (loading) {
    return <div className="text-gray-500">Cargando...</div>;
  }

  if (!data) {
    return <div className="text-gray-500">No se encontró el indoor</div>;
  }

  const handleWaterClick = (plantId: string, plantName: string) => {
    setSelectedPlant({ id: plantId, name: plantName });
    setWaterModalOpen(true);
  };

  const handleWaterSuccess = () => {
    setWaterModalOpen(false);
    setSelectedPlant(null);
    showToast("Planta regada correctamente", "success");
    refetch();
  };

  const handleCreatePlantSuccess = () => {
    showToast("Planta creada exitosamente", "success");
    refetch();
  };

  const toPlantDetail = (plant: Plant): PlantDetail => ({
    id: plant.id,
    name: plant.name,
    species: plant.species ?? null,
    indoor_id: data?.indoor.id ?? null,
    indoor_name: data?.indoor.name ?? null,
    planted_at: plant.planted_at ?? null,
    notes: plant.notes ?? null,
    watering_interval_days: plant.watering_interval_days,
    default_liters: plant.default_liters ?? 1,
    last_watered_at: plant.last_watered_at,
    next_water_at: plant.next_water_at,
  });

  const handleEditPlantSuccess = () => {
    showToast("Planta actualizada", "success");
    refetch();
  };

  const handleDeletePlant = async () => {
    if (!deleteTarget) return;
    try {
      await deletePlant(deleteTarget.id);
      showToast("Planta eliminada", "success");
      refetch();
    } catch {
      showToast("Error al eliminar la planta", "error");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return dateStr;
  };

  return (
    <div>
      <WaterModal
        isOpen={waterModalOpen}
        plantId={selectedPlant?.id || ""}
        plantName={selectedPlant?.name || ""}
        onClose={() => setWaterModalOpen(false)}
        onSuccess={handleWaterSuccess}
      />
      <CreatePlantModal
        isOpen={createPlantModalOpen}
        indoorId={id}
        onClose={() => setCreatePlantModalOpen(false)}
        onSuccess={handleCreatePlantSuccess}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header con Etapa */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <button
              onClick={() => navigate("/indoors")}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium mb-2"
            >
              ← Volver
            </button>
            <h1 className="text-3xl font-bold text-gray-800">{data.indoor.name}</h1>
          </div>
          <button
            onClick={() => setCreatePlantModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            + Añadir Planta
          </button>
        </div>

        {/* Etapa (rectángulo en el header) */}
        <StagePanel indoor={data.indoor} onUpdated={refetch} />
      </div>

      {/* ===================== ZONA 1: DISPOSITIVOS & AMBIENTE ===================== */}
      <ZoneLabel>Dispositivos & Ambiente</ZoneLabel>

      <div className="mb-8">
        <AmbientePanel indoor={data.indoor} events={data.history} onUpdated={refetch} />
      </div>

      {/* ===================== ZONA 2: AGUA & RIEGO ===================== */}
      <ZoneLabel>Agua & Riego</ZoneLabel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-8">
        <RiegoPanel indoor={data.indoor} plants={data.plants} onUpdated={refetch} />
        <HistoryPanel indoorId={data.indoor.id} events={data.history} onUpdated={refetch} />
      </div>

      {/* ===================== ZONA 3: DETALLE ===================== */}
      <ZoneLabel>Detalle</ZoneLabel>

      {/* Plantas */}
      <div className="mb-8">
        <CollapsiblePanel title="Plantas">
          {data.plants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Último Riego
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Próximo Riego
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.plants.map((plant) => (
                    <tr key={plant.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                        {plant.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(plant.last_watered_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(plant.next_water_at)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleWaterClick(plant.id, plant.name)}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          >
                            Regar
                          </button>
                          <button
                            onClick={() => setHistoryPlant(toPlantDetail(plant))}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                          >
                            Historial
                          </button>
                          <button
                            onClick={() => setEditPlant(toPlantDetail(plant))}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeleteTarget(toPlantDetail(plant))}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="🌱" title="No hay plantas aún" />
          )}
        </CollapsiblePanel>
      </div>

      {/* Checklist */}
      <div className="mb-8">
        <ChecklistPanel indoorId={data.indoor.id} currentStage={data.indoor.stage} />
      </div>

      {/* Objetivos por etapa */}
      <div className="mb-8">
        <StageTargetsPanel indoorId={data.indoor.id} currentStage={data.indoor.stage} />
      </div>

      {/* Fertilizantes */}
      <div className="mb-8">
        <FertilizersPanel indoorId={data.indoor.id} currentStage={data.indoor.stage} />
      </div>

      {/* Dispositivos (puentes Raspberry) */}
      <div className="mb-8">
        <DevicesPanel indoorId={data.indoor.id} />
      </div>

      {/* Water Modal */}
      {selectedPlant && (
        <WaterModal
          isOpen={waterModalOpen}
          plantId={selectedPlant.id}
          plantName={selectedPlant.name}
          onClose={() => {
            setWaterModalOpen(false);
            setSelectedPlant(null);
          }}
          onSuccess={handleWaterSuccess}
        />
      )}

      {/* Edit Plant Modal */}
      <EditPlantModal
        key={editPlant?.id ?? "none"}
        isOpen={!!editPlant}
        plant={editPlant}
        onClose={() => setEditPlant(null)}
        onSuccess={handleEditPlantSuccess}
      />

      {/* Plant History Modal */}
      <PlantHistoryModal
        isOpen={!!historyPlant}
        plant={historyPlant}
        onClose={() => setHistoryPlant(null)}
      />

      {/* Delete Plant Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar planta"
        message={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Se borrará también su historial de riego.`}
        confirmLabel="Eliminar"
        onConfirm={handleDeletePlant}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

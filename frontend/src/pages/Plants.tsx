import { useState } from "react";
import { usePlants, useDeletePlant, useToast } from "../hooks";
import {
  WaterModal,
  ToastContainer,
  CardSkeleton,
  EmptyState,
  EditPlantModal,
  PlantHistoryModal,
  ConfirmDialog,
} from "../components/Modals";
import { PlantDetail } from "../api/types";

export default function Plants() {
  const { data, loading, error, refetch } = usePlants();
  const { deletePlant } = useDeletePlant();
  const { toasts, showToast, removeToast } = useToast();

  const [selectedPlant, setSelectedPlant] = useState<PlantDetail | null>(null);
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [editPlant, setEditPlant] = useState<PlantDetail | null>(null);
  const [historyPlant, setHistoryPlant] = useState<PlantDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlantDetail | null>(null);

  const handleWaterClick = (plant: PlantDetail) => {
    setSelectedPlant(plant);
    setWaterModalOpen(true);
  };

  const handleWaterSuccess = () => {
    setWaterModalOpen(false);
    setSelectedPlant(null);
    showToast("Planta regada correctamente", "success");
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

  const formatDate = (dateStr: string | null) => dateStr || "—";

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error al cargar plantas: {error.message}
      </div>
    );
  }

  return (
    <div>
      <WaterModal
        isOpen={waterModalOpen}
        plantId={selectedPlant?.id || ""}
        plantName={selectedPlant?.name || ""}
        onClose={() => {
          setWaterModalOpen(false);
          setSelectedPlant(null);
        }}
        onSuccess={handleWaterSuccess}
      />
      <EditPlantModal
        key={editPlant?.id ?? "none"}
        isOpen={!!editPlant}
        plant={editPlant}
        onClose={() => setEditPlant(null)}
        onSuccess={() => {
          showToast("Planta actualizada", "success");
          refetch();
        }}
      />
      <PlantHistoryModal
        isOpen={!!historyPlant}
        plant={historyPlant}
        onClose={() => setHistoryPlant(null)}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar planta"
        message={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Se borrará también su historial de riego.`}
        confirmLabel="Eliminar"
        onConfirm={handleDeletePlant}
        onClose={() => setDeleteTarget(null)}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Plantas</h1>
        <p className="text-gray-600 mt-2">Todas tus plantas en un solo lugar.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : data && data.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Especie</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Indoor</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Último Riego</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Próximo Riego</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((plant) => (
                <tr key={plant.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{plant.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{plant.species || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{plant.indoor_name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(plant.last_watered_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(plant.next_water_at)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWaterClick(plant)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                      >
                        Regar
                      </button>
                      <button
                        onClick={() => setHistoryPlant(plant)}
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                      >
                        Historial
                      </button>
                      <button
                        onClick={() => setEditPlant(plant)}
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteTarget(plant)}
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
        <EmptyState
          icon="🌱"
          title="No hay plantas aún"
          description="Añadí plantas desde el detalle de un indoor."
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { useDashboard, useToast } from "../hooks";
import { WaterModal, ToastContainer, CardSkeleton, EmptyState } from "../components/Modals";

export default function Panel() {
  const { data: dashboard, loading, error, refetch } = useDashboard();
  const { toasts, showToast, removeToast } = useToast();
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error al cargar panel: {error.message}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Panel de Control</h1>
        <p className="text-gray-600 mt-2">Un resumen rápido de tu jardín.</p>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-3 gap-6 mb-8">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : dashboard ? (
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Indoors Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium">Indoors Totales</h3>
            <p className="text-4xl font-bold text-gray-800 mt-2">{dashboard.indoors_total}</p>
          </div>

          {/* Plants Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium">Plantas Totales</h3>
            <p className="text-4xl font-bold text-gray-800 mt-2">{dashboard.plants_total}</p>
          </div>

          {/* Need Water Card */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <h3 className="text-gray-600 text-sm font-medium">Necesitan Riego</h3>
            <p className="text-4xl font-bold text-orange-600 mt-2">
              {dashboard.need_water_count}
            </p>
          </div>
        </div>
      ) : null}

      {/* Upcoming Waterings */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Próximos Riegos</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : dashboard && dashboard.upcoming.length > 0 ? (
          <div className="space-y-3">
            {dashboard.upcoming.map((plant) => {
              const daysText =
                plant.due_in_days < 0
                  ? `Vencido hace ${Math.abs(plant.due_in_days)} días`
                  : plant.due_in_days === 0
                  ? "Hoy"
                  : `Vence en ${plant.due_in_days} días`;

              const statusColor =
                plant.status === "OVERDUE"
                  ? "bg-red-50 border-l-4 border-red-500"
                  : plant.status === "DUE_SOON"
                  ? "bg-yellow-50 border-l-4 border-yellow-500"
                  : "bg-green-50 border-l-4 border-green-500";

              const statusBadge =
                plant.status === "OVERDUE"
                  ? "bg-red-100 text-red-800"
                  : plant.status === "DUE_SOON"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-800";

              return (
                <div key={plant.plant_id} className={`rounded-lg shadow p-4 ${statusColor}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-800">{plant.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{daysText}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge}`}>
                        {plant.status}
                      </span>
                      <button
                        onClick={() => handleWaterClick(plant.plant_id, plant.name)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
                      >
                        Regar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="🌿"
            title="Todas las plantas están al día"
            description="No hay plantas que necesiten riego en este momento."
          />
        )}
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

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIndoorDetail, useUpdateIndoor, useToast } from "../hooks";
import { WaterModal, ToastContainer, EmptyState } from "../components/Modals";
import { IndoorUpdateRequest } from "../api/types";

export default function IndoorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useIndoorDetail(id || "");
  const { updateIndoor, loading: updating } = useUpdateIndoor();
  const { toasts, showToast, removeToast } = useToast();

  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<{ id: string; name: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<IndoorUpdateRequest>({});

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

  const handleFormChange = (field: keyof IndoorUpdateRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = async () => {
    try {
      await updateIndoor(id, formData);
      showToast("Cambios guardados", "success");
      setEditMode(false);
      refetch();
    } catch (err) {
      showToast("Error al guardar cambios", "error");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return dateStr;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES") + " " + date.toLocaleTimeString("es-ES");
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate("/indoors")}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium mb-2"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-bold text-gray-800">{data.indoor.name}</h1>
        </div>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium">
          + Añadir Planta
        </button>
      </div>

      {/* Plants Table */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Plantas</h2>
        {data.plants.length > 0 ? (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
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
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">{plant.name}</td>
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
                        <button className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400">
                          Historial
                        </button>
                        <button className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400">
                          Editar
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
      </div>

      {/* History Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Historial</h2>
        {data.history.length > 0 ? (
          <div className="space-y-3">
            {data.history.map((event, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <p className="text-gray-800">{event.message}</p>
                  <span className="text-sm text-gray-600">
                    {formatDateTime(event.event_ts)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="📝" title="No hay historial" />
        )}
      </div>

      {/* Indoor Details Form */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Detalles del Indoor</h2>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 font-medium"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditMode(false);
                  setFormData({});
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={updating}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50"
              >
                {updating ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Ambiente Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Ambiente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperatura (°C)
                </label>
                {editMode ? (
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temp_c ?? data.indoor.temp_c ?? ""}
                    onChange={(e) =>
                      handleFormChange("temp_c", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-600">{data.indoor.temp_c ?? "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Humedad (%)
                </label>
                {editMode ? (
                  <input
                    type="number"
                    step="0.1"
                    value={formData.humidity ?? data.indoor.humidity ?? ""}
                    onChange={(e) =>
                      handleFormChange("humidity", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-600">{data.indoor.humidity ?? "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ubicación Ventilador
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.fan_location ?? data.indoor.fan_location ?? ""}
                    onChange={(e) => handleFormChange("fan_location", e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-600">{data.indoor.fan_location ?? "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Toggles</label>
                {editMode ? (
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.extractor_top ?? data.indoor.extractor_top}
                        onChange={(e) => handleFormChange("extractor_top", e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Extractor Arriba</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.extractor_bottom ?? data.indoor.extractor_bottom}
                        onChange={(e) => handleFormChange("extractor_bottom", e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Extractor Abajo</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.fan ?? data.indoor.fan}
                        onChange={(e) => handleFormChange("fan", e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Ventilador</span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Extractor Arriba: {data.indoor.extractor_top ? "✓" : "✗"}</p>
                    <p>Extractor Abajo: {data.indoor.extractor_bottom ? "✓" : "✗"}</p>
                    <p>Ventilador: {data.indoor.fan ? "✓" : "✗"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Luz Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Luz</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Altura Luz (cm)
                </label>
                {editMode ? (
                  <input
                    type="number"
                    step="1"
                    value={formData.light_height_cm ?? data.indoor.light_height_cm ?? ""}
                    onChange={(e) =>
                      handleFormChange("light_height_cm", e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-600">{data.indoor.light_height_cm ?? "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Potencia Luz (%)
                </label>
                {editMode ? (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.light_power_pct ?? data.indoor.light_power_pct}
                    onChange={(e) => handleFormChange("light_power_pct", parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-600">{data.indoor.light_power_pct}%</p>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horario Luz
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.light_schedule ?? data.indoor.light_schedule ?? ""}
                    onChange={(e) => handleFormChange("light_schedule", e.target.value || null)}
                    placeholder="Ej: 18h-6h"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-600">{data.indoor.light_schedule ?? "—"}</p>
                )}
              </div>
            </div>
          </div>
        </div>
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

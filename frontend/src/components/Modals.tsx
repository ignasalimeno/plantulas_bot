import { useState } from "react";
import {
  useWaterPlant,
  useCreateIndoor,
  useCreatePlant,
  useUpdatePlant,
  useIndoors,
  usePlantHistory,
  useFertilizers,
} from "../hooks";
import { PlantCreateRequest, PlantDetail } from "../api/types";

interface WaterModalProps {
  isOpen: boolean;
  plantId: string;
  plantName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WaterModal({
  isOpen,
  plantId,
  plantName,
  onClose,
  onSuccess,
}: WaterModalProps) {
  const [liters, setLiters] = useState("1");
  const [note, setNote] = useState("");
  const [ec, setEc] = useState("");
  const [ph, setPh] = useState("");
  const [runoffEc, setRunoffEc] = useState("");
  const [selectedFerts, setSelectedFerts] = useState<Record<string, string>>({});
  const [soloAgua, setSoloAgua] = useState(false);
  const { waterPlant, loading, error } = useWaterPlant();
  const { data: catalog } = useFertilizers();

  if (!isOpen) return null;

  const toggleFert = (id: string, defaultAmount: number | null) => {
    setSelectedFerts((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = defaultAmount != null ? String(defaultAmount) : "";
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!liters || parseFloat(liters) <= 0) {
      alert("Por favor ingresa una cantidad válida de litros");
      return;
    }
    if (!soloAgua && Object.keys(selectedFerts).length === 0) {
      alert("Indicá al menos un fertilizante con su dosis, o marcá 'Solo agua'");
      return;
    }

    const ferts = soloAgua
      ? undefined
      : Object.entries(selectedFerts).map(([id, dose]) => {
          const fert = catalog?.find((c) => c.id === id);
          const value = dose !== "" ? dose : fert?.default_amount != null ? String(fert.default_amount) : "";
          return { name: fert?.name ?? id, amount: `${value} ml/L` };
        });

    try {
      await waterPlant(plantId, {
        liters: parseFloat(liters),
        note: note || undefined,
        ec: ec !== "" ? parseFloat(ec) : undefined,
        ph: ph !== "" ? parseFloat(ph) : undefined,
        runoff_ec: runoffEc !== "" ? parseFloat(runoffEc) : undefined,
        ferts,
      });

      // Reset form
      setLiters("1");
      setNote("");
      setEc("");
      setPh("");
      setRunoffEc("");
      setSelectedFerts({});
      setSoloAgua(false);

      // Close modal and trigger refetch
      onClose();
      onSuccess?.();
    } catch (err) {
      // Error is already in state
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Regar: {plantName}</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Litros *
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">EC</label>
              <input
                type="number"
                step="0.01"
                value={ec}
                onChange={(e) => setEc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">pH</label>
              <input
                type="number"
                step="0.01"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">EC runoff</label>
              <input
                type="number"
                step="0.01"
                value={runoffEc}
                onChange={(e) => setRunoffEc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Fertilizers */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Fertilizantes (ml/L) *
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soloAgua}
                  onChange={(e) => setSoloAgua(e.target.checked)}
                  className="w-4 h-4"
                />
                Solo agua
              </label>
            </div>
            {!catalog || catalog.length === 0 ? (
              <p className="text-xs text-gray-500">
                No hay fertilizantes en el catálogo.
              </p>
            ) : (
              <div
                className={`space-y-2 ${soloAgua ? "opacity-40 pointer-events-none" : ""}`}
              >
                {catalog.map((f) => {
                  const checked = f.id in selectedFerts;
                  return (
                    <div key={f.id} className="flex items-center gap-2">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFert(f.id, f.default_amount)}
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
                              setSelectedFerts((prev) => ({ ...prev, [f.id]: e.target.value }))
                            }
                            placeholder="0"
                            className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nota (opcional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Ej: Se agregó fertilizante"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Regar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal para crear un nuevo indoor
 */
interface CreateIndoorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateIndoorModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateIndoorModalProps) {
  const [name, setName] = useState("");
  const { createIndoor, loading, error } = useCreateIndoor();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Por favor ingresa un nombre para el indoor");
      return;
    }

    try {
      await createIndoor({ name: name.trim() });

      // Reset form
      setName("");

      // Close modal and trigger refetch
      onClose();
      onSuccess?.();
    } catch (err) {
      // Error is already in state
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Crear Indoor</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Carpa Principal"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Creando..." : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal para crear una nueva planta
 */
interface CreatePlantModalProps {
  isOpen: boolean;
  indoorId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreatePlantModal({
  isOpen,
  indoorId,
  onClose,
  onSuccess,
}: CreatePlantModalProps) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [wateringInterval, setWateringInterval] = useState("7");
  const [defaultLiters, setDefaultLiters] = useState("1.0");
  const { createPlant, loading, error } = useCreatePlant();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Por favor ingresa un nombre para la planta");
      return;
    }

    const interval = parseInt(wateringInterval);
    const liters = parseFloat(defaultLiters);

    if (interval <= 0 || liters <= 0) {
      alert("Por favor ingresa valores válidos");
      return;
    }

    try {
      const request: PlantCreateRequest = {
        name: name.trim(),
        species: species.trim() || null,
        indoor_id: indoorId || null,
        watering_interval_days: interval,
        default_liters: liters,
      };

      await createPlant(request);

      // Reset form
      setName("");
      setSpecies("");
      setWateringInterval("7");
      setDefaultLiters("1.0");

      // Close modal and trigger refetch
      onClose();
      onSuccess?.();
    } catch (err) {
      // Error is already in state
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Añadir Planta</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Monstera"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Especie (opcional)
            </label>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Monstera deliciosa"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Intervalo de Riego (días) *
            </label>
            <input
              type="number"
              min="1"
              value={wateringInterval}
              onChange={(e) => setWateringInterval(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Litros por Defecto *
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={defaultLiters}
              onChange={(e) => setDefaultLiters(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Creando..." : "Añadir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Toast notification component
 */
interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: "success" | "error" | "info" }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-md shadow-lg text-white max-w-sm ${
            toast.type === "success"
              ? "bg-green-500"
              : toast.type === "error"
              ? "bg-red-500"
              : "bg-blue-500"
          }`}
        >
          <div className="flex justify-between items-center gap-4">
            <span>{toast.message}</span>
            <button
              onClick={() => onRemove(toast.id)}
              className="font-bold hover:opacity-75"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton para cards
 */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
    </div>
  );
}

/**
 * Empty state
 */
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-800 mb-2">{title}</h3>
      {description && <p className="text-gray-600 text-sm mb-4 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Modal para editar una planta
 */
interface EditPlantModalProps {
  isOpen: boolean;
  plant: PlantDetail | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditPlantModal({ isOpen, plant, onClose, onSuccess }: EditPlantModalProps) {
  const { data: indoors } = useIndoors();
  const { updatePlant, loading, error } = useUpdatePlant();

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [indoorId, setIndoorId] = useState("");
  const [plantedAt, setPlantedAt] = useState("");
  const [interval, setInterval] = useState("7");
  const [defaultLiters, setDefaultLiters] = useState("1.0");
  const [notes, setNotes] = useState("");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  // Sync form when a different plant is opened
  if (isOpen && plant && initializedFor !== plant.id) {
    setName(plant.name);
    setSpecies(plant.species ?? "");
    setIndoorId(plant.indoor_id ?? "");
    setPlantedAt(plant.planted_at ?? "");
    setInterval(String(plant.watering_interval_days));
    setDefaultLiters(String(plant.default_liters));
    setNotes(plant.notes ?? "");
    setInitializedFor(plant.id);
  }

  if (!isOpen || !plant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const intervalNum = parseInt(interval);
    const litersNum = parseFloat(defaultLiters);

    if (!name.trim()) {
      alert("Por favor ingresa un nombre para la planta");
      return;
    }
    if (intervalNum <= 0 || litersNum <= 0) {
      alert("Por favor ingresa valores válidos");
      return;
    }

    try {
      await updatePlant(plant.id, {
        name: name.trim(),
        species: species.trim() || null,
        indoor_id: indoorId || null,
        planted_at: plantedAt || null,
        watering_interval_days: intervalNum,
        default_liters: litersNum,
        notes: notes.trim() || null,
      });
      setInitializedFor(null);
      onClose();
      onSuccess?.();
    } catch (err) {
      // Error is already in state
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[28rem] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Editar Planta</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Especie</label>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Indoor</label>
            <select
              value={indoorId}
              onChange={(e) => setIndoorId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin indoor</option>
              {plant.indoor_id &&
                !indoors?.some((i) => i.id === plant.indoor_id) && (
                  <option value={plant.indoor_id}>
                    {plant.indoor_name ?? "Indoor actual"}
                  </option>
                )}
              {indoors?.map((indoor) => (
                <option key={indoor.id} value={indoor.id}>
                  {indoor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de plantado
            </label>
            <input
              type="date"
              value={plantedAt}
              onChange={(e) => setPlantedAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Intervalo riego (días) *
              </label>
              <input
                type="number"
                min="1"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Litros por defecto *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={defaultLiters}
                onChange={(e) => setDefaultLiters(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal con el historial de riego de una planta
 */
interface PlantHistoryModalProps {
  isOpen: boolean;
  plant: PlantDetail | null;
  onClose: () => void;
}

export function PlantHistoryModal({ isOpen, plant, onClose }: PlantHistoryModalProps) {
  const { data, loading, error } = usePlantHistory(plant?.id ?? "");

  if (!isOpen || !plant) return null;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES") + " " + date.toLocaleTimeString("es-ES");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[28rem] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Historial: {plant.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error.message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : data && data.history.length > 0 ? (
          <div className="space-y-3">
            {data.history.map((item) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-800">{item.liters} L</span>
                  <span className="text-sm text-gray-500">
                    {formatDateTime(item.event_ts)}
                  </span>
                </div>
                {item.ferts && Object.keys(item.ferts).length > 0 && (
                  <div className="mt-1 text-xs text-blue-500">
                    {Object.entries(item.ferts).map(([name, amount]) => (
                      <span key={name} className="inline-block mr-3">
                        {name}: {String(amount)}
                      </span>
                    ))}
                  </div>
                )}
                {(item.ec != null || item.ph != null || item.runoff_ec != null) && (
                  <div className="mt-1 text-xs text-gray-500">
                    {item.ec != null && <span className="mr-3">EC {item.ec}</span>}
                    {item.ph != null && <span className="mr-3">pH {item.ph}</span>}
                    {item.runoff_ec != null && <span>Runoff {item.runoff_ec}</span>}
                  </div>
                )}
                {item.note && (
                  <p className="text-sm text-gray-600 mt-1">{item.note}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No hay riegos registrados.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Diálogo de confirmación genérico
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "Eliminando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

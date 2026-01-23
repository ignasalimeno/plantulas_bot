import { useState } from "react";
import { useWaterPlant, useCreateIndoor, useCreatePlant } from "../hooks";
import { IndoorCreateRequest, PlantCreateRequest } from "../api/types";

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
  const { waterPlant, loading, error } = useWaterPlant();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!liters || parseFloat(liters) <= 0) {
      alert("Por favor ingresa una cantidad válida de litros");
      return;
    }

    try {
      await waterPlant(plantId, {
        liters: parseFloat(liters),
        note: note || undefined,
      });

      // Reset form
      setLiters("1");
      setNote("");

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

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client";
import {
  DashboardResponse,
  IndoorListItem,
  IndoorDetailResponse,
  PlantWaterRequest,
  PlantWaterResponse,
  IndoorUpdateRequest,
  IndoorCreateRequest,
  PlantCreateRequest,
  IndoorDetail,
  Plant,
} from "../api/types";

interface UseState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook para obtener el dashboard (resumen y próximos riegos)
 */
export function useDashboard(): UseState<DashboardResponse> {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<DashboardResponse>("/api/dashboard");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch dashboard"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook para obtener lista de indoors
 */
export function useIndoors(): UseState<IndoorListItem[]> {
  const [data, setData] = useState<IndoorListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<IndoorListItem[]>("/api/indoors");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch indoors"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook para obtener detalle de un indoor específico
 */
export function useIndoorDetail(indoorId: string): UseState<IndoorDetailResponse> {
  const [data, setData] = useState<IndoorDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!indoorId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<IndoorDetailResponse>(`/api/indoors/${indoorId}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch indoor details"));
    } finally {
      setLoading(false);
    }
  }, [indoorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook para regar una planta
 */
export function useWaterPlant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const waterPlant = useCallback(
    async (plantId: string, request: PlantWaterRequest): Promise<PlantWaterResponse | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.post<PlantWaterResponse>(
          `/api/plants/${plantId}/water`,
          request
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to water plant");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { waterPlant, loading, error };
}

/**
 * Hook para crear un indoor
 */
export function useCreateIndoor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createIndoor = useCallback(
    async (request: IndoorCreateRequest): Promise<IndoorDetail | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.post<IndoorDetail>(
          `/api/indoors`,
          request
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to create indoor");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createIndoor, loading, error };
}

/**
 * Hook para actualizar un indoor
 */
export function useUpdateIndoor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateIndoor = useCallback(
    async (indoorId: string, updates: IndoorUpdateRequest): Promise<IndoorDetailResponse | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.patch<IndoorDetailResponse>(
          `/api/indoors/${indoorId}`,
          updates
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update indoor");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateIndoor, loading, error };
}

/**
 * Hook para crear una planta
 */
export function useCreatePlant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPlant = useCallback(
    async (request: PlantCreateRequest): Promise<Plant | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.post<Plant>(
          `/api/plants`,
          request
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to create plant");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createPlant, loading, error };
}

/**
 * Hook para toast notifications (simple state-based)
 */
interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info", duration = 3000) => {
      const id = Math.random().toString(36).substr(2, 9);
      const toast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

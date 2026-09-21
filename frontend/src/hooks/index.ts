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
  PlantDetail,
  PlantUpdateRequest,
  PlantHistoryResponse,
  StageInfo,
  StageTarget,
  StageTargetsUpdate,
  Measurement,
  MeasurementCreate,
  Task,
  TaskCreate,
  TaskUpdate,
  Fertilizer,
  FertilizerCreate,
  PlanItem,
  PlanItemInput,
  FertilizerApplication,
  IndoorWaterRequest,
  IndoorWaterResponse,
  IndoorWateringEvent,
  IndoorWateringUpdate,
  ChatMessage,
  ChatResponse,
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
 * Hook para obtener todas las plantas del usuario
 */
export function usePlants(): UseState<PlantDetail[]> {
  const [data, setData] = useState<PlantDetail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<PlantDetail[]>("/api/plants");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch plants"));
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
 * Hook para obtener el historial de riego de una planta
 */
export function usePlantHistory(plantId: string): UseState<PlantHistoryResponse> {
  const [data, setData] = useState<PlantHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!plantId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<PlantHistoryResponse>(`/api/plants/${plantId}/history`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch plant history"));
    } finally {
      setLoading(false);
    }
  }, [plantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook para actualizar una planta
 */
export function useUpdatePlant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updatePlant = useCallback(
    async (plantId: string, updates: PlantUpdateRequest): Promise<PlantDetail | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.patch<PlantDetail>(
          `/api/plants/${plantId}`,
          updates
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update plant");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updatePlant, loading, error };
}

/**
 * Hook para eliminar una planta
 */
export function useDeletePlant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deletePlant = useCallback(async (plantId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.delete(`/api/plants/${plantId}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to delete plant");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deletePlant, loading, error };
}

/**
 * Hook para obtener las etapas de cultivo
 */
export function useStages(): UseState<StageInfo[]> {
  const [data, setData] = useState<StageInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<StageInfo[]>("/api/stages");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch stages"));
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
 * Hook para obtener los targets de EC/pH por etapa de un indoor
 */
export function useStageTargets(indoorId: string): UseState<StageTarget[]> {
  const [data, setData] = useState<StageTarget[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!indoorId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<StageTarget[]>(
        `/api/indoors/${indoorId}/stage-targets`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch stage targets"));
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
 * Hook para actualizar los targets de EC/pH por etapa
 */
export function useUpdateStageTargets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateTargets = useCallback(
    async (indoorId: string, targets: StageTargetsUpdate): Promise<StageTarget[] | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.put<StageTarget[]>(
          `/api/indoors/${indoorId}/stage-targets`,
          targets
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update stage targets");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateTargets, loading, error };
}

/**
 * Hook para obtener las mediciones de un indoor
 */
export function useMeasurements(indoorId: string): UseState<Measurement[]> {
  const [data, setData] = useState<Measurement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!indoorId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<Measurement[]>(
        `/api/indoors/${indoorId}/measurements`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch measurements"));
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
 * Hook para registrar una medición
 */
export function useCreateMeasurement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createMeasurement = useCallback(
    async (indoorId: string, data: MeasurementCreate): Promise<Measurement | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.post<Measurement>(
          `/api/indoors/${indoorId}/measurements`,
          data
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to create measurement");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createMeasurement, loading, error };
}

/**
 * Hook para eliminar una medición
 */
export function useDeleteMeasurement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteMeasurement = useCallback(async (measurementId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.delete(`/api/measurements/${measurementId}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to delete measurement");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteMeasurement, loading, error };
}

/**
 * Hook para obtener las tareas/checklist de un indoor
 */
export function useTasks(indoorId: string): UseState<Task[]> {
  const [data, setData] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!indoorId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<Task[]>(`/api/indoors/${indoorId}/tasks`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch tasks"));
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
 * Hook para crear una tarea
 */
export function useCreateTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createTask = useCallback(
    async (indoorId: string, data: TaskCreate): Promise<Task | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.post<Task>(`/api/indoors/${indoorId}/tasks`, data);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to create task");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createTask, loading, error };
}

/**
 * Hook para actualizar una tarea
 */
export function useUpdateTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateTask = useCallback(
    async (taskId: string, data: TaskUpdate): Promise<Task | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.patch<Task>(`/api/tasks/${taskId}`, data);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update task");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateTask, loading, error };
}

/**
 * Hook para eliminar una tarea
 */
export function useDeleteTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.delete(`/api/tasks/${taskId}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to delete task");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteTask, loading, error };
}

/**
 * Hook para el catálogo de fertilizantes
 */
export function useFertilizers(): UseState<Fertilizer[]> {
  const [data, setData] = useState<Fertilizer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<Fertilizer[]>("/api/fertilizers");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch fertilizers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useCreateFertilizer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createFertilizer = useCallback(
    async (data: FertilizerCreate): Promise<Fertilizer | null> => {
      try {
        setLoading(true);
        setError(null);
        return await apiClient.post<Fertilizer>("/api/fertilizers", data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to create fertilizer");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createFertilizer, loading, error };
}

export function useUpdateFertilizer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateFertilizer = useCallback(
    async (id: string, data: FertilizerCreate): Promise<Fertilizer | null> => {
      try {
        setLoading(true);
        setError(null);
        return await apiClient.patch<Fertilizer>(`/api/fertilizers/${id}`, data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update fertilizer");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateFertilizer, loading, error };
}

export function useDeleteFertilizer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteFertilizer = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.delete(`/api/fertilizers/${id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to delete fertilizer");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteFertilizer, loading, error };
}

/**
 * Hook para el plan de fertilizantes de un indoor
 */
export function useFertilizerPlan(indoorId: string): UseState<PlanItem[]> {
  const [data, setData] = useState<PlanItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!indoorId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<PlanItem[]>(
        `/api/indoors/${indoorId}/fertilizer-plan`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch fertilizer plan"));
    } finally {
      setLoading(false);
    }
  }, [indoorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useUpdateFertilizerPlan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updatePlan = useCallback(
    async (indoorId: string, items: PlanItemInput[]): Promise<PlanItem[] | null> => {
      try {
        setLoading(true);
        setError(null);
        return await apiClient.put<PlanItem[]>(
          `/api/indoors/${indoorId}/fertilizer-plan`,
          { items }
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update fertilizer plan");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updatePlan, loading, error };
}

/**
 * Hook para aplicaciones de fertilizante de un indoor
 */
export function useFertilizerApplications(indoorId: string): UseState<FertilizerApplication[]> {
  const [data, setData] = useState<FertilizerApplication[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!indoorId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<FertilizerApplication[]>(
        `/api/indoors/${indoorId}/fertilizer-applications`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch applications"));
    } finally {
      setLoading(false);
    }
  }, [indoorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useCreateFertilizerApplication() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createApplication = useCallback(
    async (
      indoorId: string,
      data: { fertilizer_id: string; amount?: number | null; note?: string | null }
    ): Promise<FertilizerApplication | null> => {
      try {
        setLoading(true);
        setError(null);
        return await apiClient.post<FertilizerApplication>(
          `/api/indoors/${indoorId}/fertilizer-applications`,
          data
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to log application");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createApplication, loading, error };
}

export function useDeleteFertilizerApplication() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteApplication = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.delete(`/api/fertilizer-applications/${id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to delete application");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteApplication, loading, error };
}

/**
 * Hook para regar todas las plantas de un indoor
 */
export function useWaterIndoor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const waterIndoor = useCallback(
    async (indoorId: string, data: IndoorWaterRequest): Promise<IndoorWaterResponse | null> => {
      try {
        setLoading(true);
        setError(null);
        return await apiClient.post<IndoorWaterResponse>(
          `/api/indoors/${indoorId}/water`,
          data
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to water indoor");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { waterIndoor, loading, error };
}

/**
 * Hook para el historial de chat
 */
export function useChatHistory(): UseState<ChatMessage[]> {
  const [data, setData] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<ChatMessage[]>("/api/chat/history");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch chat history"));
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
 * Hook para enviar mensajes al asistente y confirmar acciones
 */
export function useChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(async (message: string): Promise<ChatResponse | null> => {
    try {
      setLoading(true);
      setError(null);
      return await apiClient.post<ChatResponse>("/api/chat", { message });
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to send message");
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirm = useCallback(async (approve: boolean): Promise<ChatResponse | null> => {
    try {
      setLoading(true);
      setError(null);
      return await apiClient.post<ChatResponse>("/api/chat/confirm", { approve });
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to confirm action");
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendMessage, confirm, loading, error };
}

/**
 * Hook para limpiar el historial de chat
 */
export function useClearChat() {
  const clearChat = useCallback(async (): Promise<void> => {
    await apiClient.delete("/api/chat/history");
  }, []);

  return { clearChat };
}

/**
 * Hook para el historial de riego de un indoor (merge de plantas)
 */
export function useIndoorWateringHistory(indoorId: string): UseState<IndoorWateringEvent[]> {
  const [data, setData] = useState<IndoorWateringEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!indoorId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.get<IndoorWateringEvent[]>(
        `/api/indoors/${indoorId}/watering-history`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch watering history"));
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
 * Hook para editar un evento de riego (todas sus plantas)
 */
export function useUpdateWateringEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateWateringEvent = useCallback(
    async (groupId: string, data: IndoorWateringUpdate): Promise<IndoorWateringEvent | null> => {
      try {
        setLoading(true);
        setError(null);
        return await apiClient.patch<IndoorWateringEvent>(
          `/api/indoors/watering-events/${groupId}`,
          data
        );
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Failed to update watering event");
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateWateringEvent, loading, error };
}

/**
 * Hook para eliminar un evento de riego
 */
export function useDeleteWateringEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteWateringEvent = useCallback(async (groupId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.delete(`/api/indoors/watering-events/${groupId}`);
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to delete watering event");
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteWateringEvent, loading, error };
}

/**
 * Hook para agregar un evento manual al historial del indoor
 */
export function useCreateIndoorHistoryEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createHistoryEvent = useCallback(
    async (indoorId: string, message: string) => {
      try {
        setLoading(true);
        setError(null);
        return await apiClient.post(`/api/indoors/${indoorId}/history`, { message });
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Failed to create history event");
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createHistoryEvent, loading, error };
}

/**
 * Hook para eliminar un evento del historial del indoor
 */
export function useDeleteIndoorHistoryEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteHistoryEvent = useCallback(
    async (indoorId: string, eventId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await apiClient.delete(`/api/indoors/${indoorId}/history/${eventId}`);
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Failed to delete history event");
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { deleteHistoryEvent, loading, error };
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

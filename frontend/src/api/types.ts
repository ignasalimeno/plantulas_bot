/**
 * Types para respuestas de la API del backend
 */

export interface DashboardResponse {
  indoors_total: number;
  plants_total: number;
  need_water_count: number;
  upcoming: PlantUpcoming[];
}

export interface PlantUpcoming {
  plant_id: string;
  name: string;
  next_water_at: string; // YYYY-MM-DD
  due_in_days: number;
  status: "OVERDUE" | "DUE_SOON" | "OK";
}

export interface IndoorListItem {
  id: string;
  name: string;
  plants_count: number;
}

export interface Plant {
  id: string;
  name: string;
  species?: string;
  last_watered_at: string | null; // YYYY-MM-DD
  next_water_at: string | null; // YYYY-MM-DD
  watering_interval_days: number;
  default_liters?: number;
}

export interface IndoorHistory {
  event_ts: string; // ISO datetime
  message: string;
}

export interface IndoorDetailResponse {
  indoor: IndoorDetail;
  plants: Plant[];
  history: IndoorHistory[];
}

export interface IndoorDetail {
  id: string;
  name: string;
  temp_c: number | null;
  humidity: number | null;
  fan_location: string | null;
  extractor_top: boolean;
  extractor_bottom: boolean;
  fan: boolean;
  light_height_cm: number | null;
  light_power_pct: number;
  light_schedule: string | null;
}

export interface WateringHistory {
  id: string;
  event_ts: string; // ISO datetime
  liters: number;
  note: string | null;
  ferts?: any;
}

export interface PlantWaterRequest {
  liters: number;
  date?: string; // YYYY-MM-DD, optional
  note?: string;
  ferts?: Array<{ name: string; grams: number }>;
}

export interface PlantWaterResponse {
  plant: Plant & { watering_history: WateringHistory[] };
  watering_history: WateringHistory;
}

export interface IndoorUpdateRequest {
  name?: string;
  temp_c?: number | null;
  humidity?: number | null;
  fan_location?: string | null;
  extractor_top?: boolean;
  extractor_bottom?: boolean;
  fan?: boolean;
  light_height_cm?: number | null;
  light_power_pct?: number;
  light_schedule?: string | null;
}

export interface ApiError {
  detail?: string | { msg: string; loc?: string[] }[];
  message?: string;
}

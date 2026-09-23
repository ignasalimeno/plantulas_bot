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
  planted_at?: string | null;
  notes?: string | null;
}

export interface IndoorHistory {
  id: string;
  event_ts: string; // ISO datetime
  message: string;
}

export interface IndoorDetailResponse {
  indoor: IndoorDetail;
  plants: Plant[];
  history: IndoorHistory[];
}

export interface CurrentReading {
  value: number | null;
  at: string | null;
  source: string | null; // "measurement" | "watering" | "indoor"
}

export interface CurrentEnvironment {
  temp_c: CurrentReading;
  humidity: CurrentReading;
  ec: CurrentReading;
  ph: CurrentReading;
  runoff_ec: CurrentReading;
  ppfd: CurrentReading;
  light_height_cm: number | null;
  light_power_pct: number | null;
  light_schedule: string | null;
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
  humidifier: boolean;
  humidifier_mode: string;
  humidifier_on_below_humidity: number | null;
  humidifier_off_above_humidity: number | null;
  humidifier_on_above_temp: number | null;
  humidifier_off_below_temp: number | null;
  ac: boolean;
  ac_mode: string;
  ac_on_above_temp: number | null;
  ac_off_below_temp: number | null;
  ac_hvac_mode: string | null;
  light_height_cm: number | null;
  light_power_pct: number | null;
  light_schedule: string | null;
  stage: string;
  stage_started_at: string | null;
  current_environment?: CurrentEnvironment | null;
}

export interface WateringHistory {
  id: string;
  event_ts: string; // ISO datetime
  liters: number;
  note: string | null;
  ferts?: any;
  ec?: number | null;
  ph?: number | null;
  runoff_ec?: number | null;
}

export interface PlantWaterRequest {
  liters: number;
  date?: string; // YYYY-MM-DD, optional
  note?: string;
  ferts?: Array<{ name: string; amount: string }>;
  ec?: number;
  ph?: number;
  runoff_ec?: number;
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
  humidifier?: boolean;
  humidifier_mode?: string;
  humidifier_on_below_humidity?: number | null;
  humidifier_off_above_humidity?: number | null;
  humidifier_on_above_temp?: number | null;
  humidifier_off_below_temp?: number | null;
  ac?: boolean;
  ac_mode?: string;
  ac_on_above_temp?: number | null;
  ac_off_below_temp?: number | null;
  ac_hvac_mode?: string | null;
  light_height_cm?: number | null;
  light_power_pct?: number;
  light_schedule?: string | null;
  stage?: string;
  stage_started_at?: string | null;
}

export interface IndoorCreateRequest {
  name: string;
  temp_c?: number | null;
  humidity?: number | null;
  fan_location?: string | null;
  extractor_top?: boolean;
  extractor_bottom?: boolean;
  fan?: boolean;
  humidifier?: boolean;
  humidifier_on_below_humidity?: number | null;
  humidifier_off_above_humidity?: number | null;
  humidifier_on_above_temp?: number | null;
  humidifier_off_below_temp?: number | null;
  light_height_cm?: number | null;
  light_power_pct?: number | null;
  light_schedule?: string | null;
  stage?: string | null;
  stage_started_at?: string | null;
}

export interface PlantCreateRequest {
  name: string;
  species?: string | null;
  indoor_id?: string | null;
  planted_at?: string | null; // YYYY-MM-DD
  watering_interval_days?: number;
  default_liters?: number;
  notes?: string | null;
}

export interface PlantDetail {
  id: string;
  name: string;
  species: string | null;
  indoor_id: string | null;
  indoor_name: string | null;
  planted_at: string | null;
  notes: string | null;
  watering_interval_days: number;
  default_liters: number;
  last_watered_at: string | null;
  next_water_at: string | null;
}

export interface PlantUpdateRequest {
  name?: string;
  species?: string | null;
  indoor_id?: string | null;
  planted_at?: string | null;
  watering_interval_days?: number;
  default_liters?: number;
  notes?: string | null;
}

export interface PlantHistoryResponse {
  plant: PlantDetail;
  history: WateringHistory[];
}

export interface StageInfo {
  key: string;
  label: string;
}

export interface StageTarget {
  stage: string;
  ec_min: number | null;
  ec_max: number | null;
  ph_min: number | null;
  ph_max: number | null;
  temp_min: number | null;
  temp_max: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  light_height_min: number | null;
  light_height_max: number | null;
  ppfd_min: number | null;
  ppfd_max: number | null;
  light_schedule: string | null;
  notes: string | null;
}

export interface StageTargetsUpdate {
  targets: StageTarget[];
}

export interface Measurement {
  id: string;
  event_ts: string;
  temp_c: number | null;
  humidity: number | null;
  ph: number | null;
  ec: number | null;
  runoff_ec: number | null;
  ppfd: number | null;
  note: string | null;
}

export interface MeasurementCreate {
  event_ts?: string;
  temp_c?: number | null;
  humidity?: number | null;
  ph?: number | null;
  ec?: number | null;
  runoff_ec?: number | null;
  ppfd?: number | null;
  note?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  frequency: string | null;
  stage: string | null;
  is_done: boolean;
  due_at: string | null;
  completed_at: string | null;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  frequency?: string | null;
  stage?: string | null;
  due_at?: string | null;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  frequency?: string | null;
  stage?: string | null;
  is_done?: boolean;
  due_at?: string | null;
}

export interface PendingAction {
  actions: Array<{ tool: string; arguments: Record<string, any> }>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending_action: PendingAction | null;
  created_at: string;
}

export interface ChatResponse {
  reply: string;
  pending_action: PendingAction | null;
}

export interface DeviceHaEntities {
  temp?: string | null;
  humidity?: string | null;
  humidifier?: string | null;
  ac?: string | null;
}

export interface Device {
  id: string;
  indoor_id: string;
  name: string;
  ha_entities: DeviceHaEntities | null;
  reported_state: Record<string, any> | null;
  last_seen: string | null;
  active: boolean;
}

export interface DeviceCreate {
  name: string;
  ha_entities?: DeviceHaEntities;
}

export interface DeviceCreateResponse {
  device: Device;
  token: string;
}

export interface Fertilizer {
  id: string;
  name: string;
  kind: string | null;
  unit: string | null;
  default_amount: number | null;
  notes: string | null;
}

export interface FertilizerCreate {
  name: string;
  kind?: string | null;
  unit?: string | null;
  default_amount?: number | null;
  notes?: string | null;
}

export interface PlanItem {
  id: string;
  fertilizer_id: string;
  fertilizer_name: string;
  kind: string | null;
  unit: string | null;
  default_amount: number | null;
  frequency: string | null;
  stage: string | null;
  active: boolean;
  last_applied_at: string | null;
}

export interface PlanItemInput {
  fertilizer_id: string;
  frequency?: string | null;
  stage?: string | null;
  active?: boolean;
}

export interface FertilizerApplication {
  id: string;
  fertilizer_id: string;
  fertilizer_name: string;
  applied_at: string;
  amount: number | null;
  note: string | null;
}

export interface IndoorWaterRequest {
  liters: number;
  date?: string;
  note?: string;
  ec?: number;
  ph?: number;
  runoff_ec?: number;
  plant_ids?: string[];
  fertilizers?: Array<{ fertilizer_id: string; amount?: number }>;
}

export interface IndoorWaterResponse {
  plants_watered: number;
  liters: number;
  plant_names: string[];
  applications_created: number;
}

export interface IndoorWateringItem {
  id: string;
  plant_id: string;
  plant_name: string;
  event_ts: string;
  liters: number;
  note: string | null;
  ferts?: any;
  ec?: number | null;
  ph?: number | null;
  runoff_ec?: number | null;
}

export interface IndoorWateringEventPlant {
  id: string;
  name: string;
}

export interface IndoorWateringEvent {
  group_id: string;
  event_ts: string;
  liters: number;
  ec: number | null;
  ph: number | null;
  runoff_ec: number | null;
  note: string | null;
  plants: IndoorWateringEventPlant[];
}

export interface IndoorWateringUpdate {
  liters?: number;
  ec?: number;
  ph?: number;
  runoff_ec?: number;
  note?: string;
  date?: string;
  plant_ids?: string[];
}

export interface ApiError {
  detail?: string | { msg: string; loc?: string[] }[];
  message?: string;
}

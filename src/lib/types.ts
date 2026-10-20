// Hand-written mirrors of the backend Pydantic models (backend/models/*.py). Keep in sync.

export interface Tornado {
  id: string;
  om: string;
  year: number;
  month: number;
  day: number;
  date: string;
  time: string;
  tz: string;
  country: string;
  state: string;
  state_name: string;
  counties: string[];
  mag: number | null;
  scale: string;
  rating: string;
  injuries: number;
  fatalities: number;
  damage_usd: number | null;
  damage_category: string | null;
  start_lat: number;
  start_lon: number;
  end_lat: number | null;
  end_lon: number | null;
  length_mi: number | null;
  width_yd: number | null;
  states_crossed: number;
  wiki_title: string | null;
  thumbnail: string | null;
  outbreak: string | null;
}

export interface TornadoPage {
  items: Tornado[];
  total: number;
  page: number;
  page_size: number;
}

export interface MapPoint {
  id: string;
  rating: string;
  mag: number | null;
  date: string;
  state: string;
  fatalities: number;
  injuries: number;
  start_lat: number;
  start_lon: number;
  end_lat: number | null;
  end_lon: number | null;
  length_mi: number | null;
  wiki_title: string | null;
}

export interface MapResponse {
  items: MapPoint[];
  total: number;
  truncated: boolean;
}

export interface Outbreak {
  id: string;
  title: string;
  wiki_title: string | null;
  start_date: string;
  end_date: string;
  year: number;
  extract: string | null;
  thumbnail: string | null;
  count: number;
  fatalities: number;
  injuries: number;
  violent: number;
}

export interface LabelCount { label: string; count: number }
export interface YearStat { year: number; count: number; fatalities: number; injuries: number }
export interface MonthStat { month: number; count: number }
export interface StateStat { state: string; state_name: string; count: number; fatalities: number }

export interface Stats {
  total: number;
  fatalities: number;
  injuries: number;
  avg_length_mi: number | null;
  avg_width_yd: number | null;
  longest: Tornado | null;
  widest: Tornado | null;
  deadliest: Tornado[];
  by_rating: LabelCount[];
  by_year: YearStat[];
  by_month: MonthStat[];
  by_state: StateStat[];
  min_date: string | null;
  max_date: string | null;
}

export interface WikiImage {
  title: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
  artist: string | null;
  license: string | null;
  license_url: string | null;
  description: string | null;
  source_page: string;
}

export interface WikiArticle {
  title: string;
  description: string | null;
  extract: string | null;
  url: string;
  thumbnail: string | null;
  lead_image: WikiImage | null;
  images: WikiImage[];
}

export interface TornadoMedia {
  event_name: string;
  place: string;
  article: WikiArticle | null;
  images: WikiImage[];
}

export interface GeoResult {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  population: number | null;
}

export interface WeatherResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number | null;
  fetched_at: string;
  source: string;
  current_time: string;
  current: Record<string, number | null>;
  hourly: Record<string, (number | null)[]>;
  hourly_time: string[];
  daily: Record<string, (number | null)[]>;
  daily_time: string[];
  sunrise: string[];
  sunset: string[];
}

export interface GridCell {
  lat: number;
  lon: number;
  temperature: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  cloud_cover: number | null;
  precipitation: number | null;
}

export interface GridResponse {
  cells: GridCell[];
  dlat: number;
  dlon: number;
  fetched_at: string;
  model_time: string | null;
  source: string;
}

export interface RadarFrame { time: number; path: string; kind: "past" | "nowcast" | string }

export interface RadarResponse {
  host: string;
  generated: number;
  frames: RadarFrame[];
  nowcast_available: boolean;
  source: string;
}

export interface Alert {
  id: string;
  event: string;
  severity: string;
  urgency: string;
  certainty: string;
  status: string;
  message_type: string;
  sender_name: string;
  area_desc: string;
  sent: string | null;
  effective: string | null;
  onset: string | null;
  expires: string | null;
  ends: string | null;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  geometry: GeoJSON.Geometry | null;
  source_url: string;
  is_active: boolean;
  category: string;
}

export interface AlertsResponse {
  items: Alert[];
  fetched_at: string;
  source: string;
  coverage_note: string;
}

export interface Settings {
  temp_unit: "C" | "F";
  wind_unit: "kmh" | "mph" | "ms" | "kn";
  distance_unit: "km" | "mi";
  precip_unit: "mm" | "in";
  time_format: "local" | "utc";
  default_basemap: Basemap;
  home_name: string;
  home_lat: number;
  home_lon: number;
}

export interface SavedLocation { id: string; name: string; latitude: number; longitude: number }
export interface SavedSearch { id: string; name: string; params: Record<string, string>; created_at: string }

export interface Profile {
  settings: Settings;
  favorite_tornadoes: string[];
  locations: SavedLocation[];
  saved_searches: SavedSearch[];
}

export type Basemap = "standard" | "dark" | "satellite";
export type GridVar = "none" | "temperature" | "wind" | "clouds";

export interface LayerState {
  basemap: Basemap;
  precipitation: boolean;
  grid: GridVar;
  tornadoes: boolean;
  paths: boolean;
  alerts: boolean;
  radarOpacity: number;
  gridOpacity: number;
}

export interface Place { name: string; lat: number; lon: number }

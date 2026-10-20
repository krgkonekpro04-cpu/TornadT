import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import type {
  AlertsResponse, GeoResult, GridResponse, MapResponse, Outbreak, Profile, RadarResponse, Settings,
  SavedLocation, Stats, Tornado, TornadoMedia, TornadoPage, WeatherResponse, WikiArticle,
} from "./types";
import { DEFAULT_SETTINGS } from "./units";
import { loadNoaaTornadoes, tornadoMap, tornadoPage, tornadoStats } from "./noaaTornadoes";

export const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  });
  return u.toString();
};

export type FilterParams = Record<string, string>;

export const useNoaaTornadoes = () => useQuery({
  queryKey: ["noaa-spc-tornadoes"],
  queryFn: loadNoaaTornadoes,
  staleTime: Infinity,
  gcTime: Infinity,
  retry: 2,
});

export const useTornadoPage = (params: FilterParams, searchPlaces: Array<{ latitude: number; longitude: number }> = []) =>
  useQuery({
    queryKey: ["tornadoes", params, searchPlaces.map((p) => [p.latitude, p.longitude])],
    queryFn: async () => tornadoPage(await loadNoaaTornadoes(), params, searchPlaces),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

export const useTornadoMap = (params: FilterParams, enabled = true, searchPlaces: Array<{ latitude: number; longitude: number }> = []) =>
  useQuery({
    queryKey: ["tornado-map", params, searchPlaces.map((p) => [p.latitude, p.longitude])],
    queryFn: async () => tornadoMap(await loadNoaaTornadoes(), params, searchPlaces),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
    enabled,
  });

export const useTornado = (id: string | null) =>
  useQuery({
    queryKey: ["tornado", id],
    queryFn: async () => {
      const record = (await loadNoaaTornadoes()).find((t) => t.id === id);
      if (!record) throw new Error("Tornado record not found in NOAA SPC data");
      return record;
    },
    enabled: !!id,
    staleTime: Infinity,
  });

export const useTornadoBatch = (ids: string[]) =>
  useQuery({
    queryKey: ["tornado-batch", ids],
    queryFn: async () => {
      const byId = new Map((await loadNoaaTornadoes()).map((t) => [t.id, t]));
      return ids.map((id) => byId.get(id)).filter((t): t is Tornado => !!t);
    },
    enabled: ids.length > 0,
    staleTime: Infinity,
  });

export const useNotable = () => {
  return useQuery({ queryKey: ["notable"], queryFn: async () => (await loadNoaaTornadoes()).filter((t) => t.fatalities > 0 || (t.mag ?? -1) >= 4).sort((a, b) => b.fatalities - a.fatalities || (b.mag ?? -1) - (a.mag ?? -1)).slice(0, 100), staleTime: Infinity });
};

export const useOutbreaks = () =>
  useQuery({ queryKey: ["outbreaks"], queryFn: () => apiGet<Outbreak[]>("/outbreaks"), staleTime: Infinity });

export const useStats = (params: FilterParams, enabled = true) =>
  useQuery({
    queryKey: ["stats", params],
    queryFn: async () => tornadoStats(await loadNoaaTornadoes(), params),
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    enabled,
  });

export const useWiki = (title: string | null | undefined) =>
  useQuery({
    queryKey: ["wiki", title],
    queryFn: () => apiGet<WikiArticle>(`/wiki?${qs({ title })}`),
    enabled: !!title,
    staleTime: Infinity,
    retry: 1,
  });

export const useTornadoMedia = (t: Tornado | null | undefined, enabled = true) => {
  return useQuery({
    queryKey: ["tornado-media", t?.id],
    queryFn: () => apiGet<TornadoMedia>(`/tornado-media?${qs({ id: t!.id, year: t!.year, state: t!.state_name, lat: t!.start_lat, lon: t!.start_lon, county: t!.counties[0], title: t!.wiki_title })}`),
    enabled: !!t && enabled,
    staleTime: Infinity,
    retry: 1,
  });
};

export const useGeocode = (q: string) =>
  useQuery({
    queryKey: ["geocode", q],
    queryFn: async () => {
      const params = new URLSearchParams({ name: q.trim(), count: "8", language: "en", format: "json" });
      const response = await fetch(`/geocode/v1/search?${params}`);
      if (!response.ok) throw new Error(`City search failed (${response.status})`);
      const result = await response.json() as { results?: Array<GeoResult & { id: number | string }> };
      return (result.results ?? []).map((place) => ({ ...place, id: String(place.id) }));
    },
    enabled: q.trim().length >= 2,
    staleTime: Infinity,
  });

export const useWeather = (lat: number | undefined, lon: number | undefined) =>
  useQuery({
    queryKey: ["weather", lat?.toFixed(2), lon?.toFixed(2)],
    queryFn: async (): Promise<WeatherResponse> => {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        timezone: "auto",
        forecast_days: "7",
        forecast_hours: "48",
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,wind_gusts_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max",
      });
      const response = await fetch(`/open-meteo/v1/forecast?${params}`);
      if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
      const raw = await response.json() as {
        latitude: number; longitude: number; timezone: string; elevation: number | null;
        current?: { time?: string; [key: string]: unknown };
        hourly?: { time?: string[]; [key: string]: unknown };
        daily?: { time?: string[]; sunrise?: string[]; sunset?: string[]; [key: string]: unknown };
      };
      if (!raw.current?.time || !raw.hourly?.time || !raw.daily?.time) throw new Error("Open-Meteo returned an incomplete forecast");
      const { time: current_time, ...current } = raw.current;
      const { time: hourly_time, ...hourly } = raw.hourly;
      const { time: daily_time, sunrise = [], sunset = [], ...daily } = raw.daily;
      return {
        latitude: raw.latitude, longitude: raw.longitude, timezone: raw.timezone, elevation: raw.elevation,
        current_time, current: current as WeatherResponse["current"],
        hourly_time, hourly: hourly as WeatherResponse["hourly"],
        daily_time, daily: daily as WeatherResponse["daily"], sunrise, sunset,
        fetched_at: new Date().toISOString(), source: "Open-Meteo.com (CC BY 4.0)",
      };
    },
    enabled: lat != null && lon != null,
    staleTime: 10 * 60_000,
  });

export const useGrid = (bbox: [number, number, number, number] | null, enabled: boolean) =>
  useQuery({
    queryKey: ["grid", bbox],
    queryFn: () => {
      const [south, west, north, east] = bbox!;
      return apiGet<GridResponse>(`/weather/grid?${qs({ south, west, north, east })}`);
    },
    enabled: enabled && !!bbox,
    staleTime: 15 * 60_000,
    placeholderData: keepPreviousData,
  });

const RAINVIEWER_INDEX = "/radar-index";

async function fetchRadarIndex(): Promise<RadarResponse> {
  const response = await fetch(RAINVIEWER_INDEX, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`RainViewer radar request failed (${response.status})`);

  const index = await response.json() as {
    host?: string;
    generated?: number;
    radar?: {
      past?: Array<{ time: number; path: string }>;
      nowcast?: Array<{ time: number; path: string }>;
    };
  };
  if (!index.host || !Number.isFinite(index.generated) || !Array.isArray(index.radar?.past)) {
    throw new Error("RainViewer returned an invalid radar index");
  }

  const past = index.radar.past.map((frame) => ({ ...frame, kind: "past" }));
  const nowcast = (index.radar.nowcast ?? []).map((frame) => ({ ...frame, kind: "nowcast" }));
  if (!past.length) throw new Error("RainViewer has no recent radar frames");
  return {
    host: index.host,
    generated: index.generated!,
    frames: [...past, ...nowcast],
    nowcast_available: nowcast.length > 0,
    source: "RainViewer",
  };
}

export const useRadar = (enabled = true) =>
  useQuery({
    queryKey: ["radar"],
    queryFn: fetchRadarIndex,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const useAlerts = (status: "active" | "all" = "active", area?: string) =>
  useQuery({
    queryKey: ["alerts", status, area ?? ""],
    queryFn: () => apiGet<AlertsResponse>(`/alerts?${qs({ status, area })}`),
    staleTime: 45_000,
    refetchInterval: 60_000,
  });

// ---- profile (single shared profile on the server) ----
export const useProfile = () =>
  useQuery({ queryKey: ["profile"], queryFn: () => apiGet<Profile>("/profile"), staleTime: Infinity });

export const useSettings = (): Settings => {
  const { data } = useProfile();
  return data?.settings ?? DEFAULT_SETTINGS;
};

function useProfileMutation<V>(fn: (v: V) => Promise<Profile>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });
}

export const useSaveSettings = () => useProfileMutation((s: Settings) => apiPut<Profile>("/profile/settings", s));
export const useToggleFavorite = () =>
  useProfileMutation(({ id, on }: { id: string; on: boolean }) =>
    on ? apiPost<Profile>(`/profile/favorites/${id}`) : apiDelete<Profile>(`/profile/favorites/${id}`));
export const useAddLocation = () =>
  useProfileMutation((l: Omit<SavedLocation, "id">) => apiPost<Profile>("/profile/locations", l));
export const useRemoveLocation = () => useProfileMutation((id: string) => apiDelete<Profile>(`/profile/locations/${id}`));
export const useAddSearch = () =>
  useProfileMutation((b: { name: string; params: Record<string, string> }) => apiPost<Profile>("/profile/searches", b));
export const useRemoveSearch = () => useProfileMutation((id: string) => apiDelete<Profile>(`/profile/searches/${id}`));

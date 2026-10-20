import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  temp_unit: "C",
  wind_unit: "kmh",
  distance_unit: "km",
  precip_unit: "mm",
  time_format: "local",
  default_basemap: "dark",
  home_name: "Oklahoma City, Oklahoma",
  home_lat: 35.4676,
  home_lon: -97.5164,
};

export const NA = "Not available";

export function temp(c: number | null | undefined, s: Settings, digits = 0): string {
  if (c == null) return "—";
  const v = s.temp_unit === "F" ? c * 9 / 5 + 32 : c;
  return `${v.toFixed(digits)}°${s.temp_unit}`;
}
export function tempValue(c: number | null | undefined, s: Settings): number | null {
  if (c == null) return null;
  return s.temp_unit === "F" ? +(c * 9 / 5 + 32).toFixed(1) : c;
}

const WIND_LABEL = { kmh: "km/h", mph: "mph", ms: "m/s", kn: "kn" } as const;
export function windValue(kmh: number | null | undefined, s: Settings): number | null {
  if (kmh == null) return null;
  const f = { kmh: 1, mph: 0.621371, ms: 1 / 3.6, kn: 0.539957 }[s.wind_unit];
  return +(kmh * f).toFixed(1);
}
export function wind(kmh: number | null | undefined, s: Settings): string {
  const v = windValue(kmh, s);
  return v == null ? "—" : `${Math.round(v)} ${WIND_LABEL[s.wind_unit]}`;
}
export const windUnit = (s: Settings) => WIND_LABEL[s.wind_unit];

export function mphRange(lo: number, hi: number | null, s: Settings): string {
  const conv = (mph: number) => windValue(mph * 1.609344, s) ?? 0;
  const u = WIND_LABEL[s.wind_unit];
  return hi == null ? `> ${Math.round(conv(lo))} ${u}` : `${Math.round(conv(lo))}–${Math.round(conv(hi))} ${u}`;
}

export function precip(mm: number | null | undefined, s: Settings): string {
  if (mm == null) return "—";
  return s.precip_unit === "in" ? `${(mm / 25.4).toFixed(2)} in` : `${mm.toFixed(1)} mm`;
}
export function precipValue(mm: number | null | undefined, s: Settings): number | null {
  if (mm == null) return null;
  return s.precip_unit === "in" ? +(mm / 25.4).toFixed(2) : mm;
}

export function distanceMi(mi: number | null | undefined, s: Settings): string {
  if (mi == null) return NA;
  return s.distance_unit === "km" ? `${(mi * 1.609344).toFixed(1)} km` : `${mi.toFixed(1)} mi`;
}
export function widthYd(yd: number | null | undefined, s: Settings): string {
  if (yd == null) return NA;
  return s.distance_unit === "km" ? `${Math.round(yd * 0.9144)} m` : `${Math.round(yd)} yd`;
}
export function visibility(m: number | null | undefined, s: Settings): string {
  if (m == null) return NA;
  return s.distance_unit === "km" ? `${(m / 1000).toFixed(1)} km` : `${(m / 1609.344).toFixed(1)} mi`;
}

export function compass(deg: number | null | undefined): string {
  if (deg == null) return "—";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function fmtDateTime(iso: string | null | undefined, s: Settings): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return s.time_format === "utc"
    ? d.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC"
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export function fmtUsd(v: number | null): string {
  if (v == null) return NA;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)} billion`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)} million`;
  return `$${Math.round(v).toLocaleString()}`;
}

export const fmtInt = (n: number) => n.toLocaleString("en-US");

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return `${Math.round(diff / 86400)} d ago`;
}

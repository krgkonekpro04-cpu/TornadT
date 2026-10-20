import type { LucideIcon } from "lucide-react";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, Snowflake,
} from "lucide-react";
import type { Tornado } from "./types";

export const EF_COLORS: Record<string, string> = {
  "0": "#60A5FA",
  "1": "#34D399",
  "2": "#FBBF24",
  "3": "#F97316",
  "4": "#EF4444",
  "5": "#EC4899",
  U: "#94A3B8",
};

export const magColor = (mag: number | null) => EF_COLORS[mag == null ? "U" : String(mag)];

// Wind-speed ranges of each scale (mph). These are the scale definitions, NOT measurements.
const EF_WIND: [number, number | null][] = [[65, 85], [86, 110], [111, 135], [136, 165], [166, 200], [200, null]];
const F_WIND: [number, number | null][] = [[40, 72], [73, 112], [113, 157], [158, 206], [207, 260], [261, 318]];

export function windRange(t: Pick<Tornado, "mag" | "scale">): [number, number | null] | null {
  if (t.mag == null) return null;
  return (t.scale === "EF" ? EF_WIND : F_WIND)[t.mag];
}

export function locationLabel(t: Tornado): string {
  const named = t.counties.filter((county) => county && !/^FIPS\b/i.test(county));
  const c = named.length ? named.slice(0, 2).join(", ") : null;
  return c ? `${c}, ${t.state_name}` : t.state_name;
}

export const WMO: Record<number, [string, LucideIcon]> = {
  0: ["Clear sky", Sun],
  1: ["Mainly clear", CloudSun],
  2: ["Partly cloudy", CloudSun],
  3: ["Overcast", Cloud],
  45: ["Fog", CloudFog],
  48: ["Depositing rime fog", CloudFog],
  51: ["Light drizzle", CloudDrizzle],
  53: ["Drizzle", CloudDrizzle],
  55: ["Dense drizzle", CloudDrizzle],
  56: ["Freezing drizzle", CloudDrizzle],
  57: ["Dense freezing drizzle", CloudDrizzle],
  61: ["Slight rain", CloudRain],
  63: ["Moderate rain", CloudRain],
  65: ["Heavy rain", CloudRain],
  66: ["Freezing rain", CloudRain],
  67: ["Heavy freezing rain", CloudRain],
  71: ["Slight snowfall", CloudSnow],
  73: ["Moderate snowfall", CloudSnow],
  75: ["Heavy snowfall", CloudSnow],
  77: ["Snow grains", Snowflake],
  80: ["Slight rain showers", CloudRain],
  81: ["Moderate rain showers", CloudRain],
  82: ["Violent rain showers", CloudRain],
  85: ["Slight snow showers", CloudSnow],
  86: ["Heavy snow showers", CloudSnow],
  95: ["Thunderstorm", CloudLightning],
  96: ["Thunderstorm, slight hail", CloudLightning],
  99: ["Thunderstorm, heavy hail", CloudLightning],
};

export function wmo(code: number | null | undefined): [string, LucideIcon] {
  if (code == null) return ["Not available", Cloud];
  return WMO[code] ?? ["Unknown", Cloud];
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"], ["PR", "Puerto Rico"],
];

// Continuous colour ramps for model grids
type Stop = [number, string];
export const TEMP_STOPS: Stop[] = [[-30, "#312E81"], [-15, "#3B82F6"], [0, "#06B6D4"], [10, "#22C55E"], [20, "#EAB308"], [30, "#F97316"], [40, "#DC2626"]];
export const WIND_STOPS: Stop[] = [[0, "#1E3A8A"], [10, "#0EA5E9"], [25, "#22C55E"], [40, "#EAB308"], [60, "#F97316"], [90, "#DC2626"], [120, "#C026D3"]];
export const CLOUD_STOPS: Stop[] = [[0, "#0B1020"], [30, "#334155"], [60, "#64748B"], [85, "#CBD5E1"], [100, "#F1F5F9"]];

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
export function ramp(stops: Stop[], v: number): string {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      const x = hex(ca), y = hex(cb);
      return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
    }
  }
  return stops[stops.length - 1][1];
}

export function severityTone(sev: string, event: string): "red" | "orange" | "cyan" {
  if (/tornado/i.test(event) || sev === "Extreme") return "red";
  if (/warning/i.test(event) || sev === "Severe") return "orange";
  return "cyan";
}
export const TONE_COLOR = { red: "#EF4444", orange: "#F97316", cyan: "#06B6D4" } as const;

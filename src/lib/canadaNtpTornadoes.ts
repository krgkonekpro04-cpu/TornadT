import type { Tornado } from "./types";

const LAYER_URL = "https://services.arcgis.com/rGKxabTU9mcXMw7k/ArcGIS/rest/services/NTP_Event_Summaries_Dashboard/FeatureServer/0/query";
const PAGE_SIZE = 1000;
const PROVINCES: Record<string, [string, string]> = {
  AB: ["AB", "Alberta"], BC: ["BC", "British Columbia"], MB: ["MB", "Manitoba"],
  NB: ["NB", "New Brunswick"], NL: ["NL", "Newfoundland and Labrador"],
  NS: ["NS", "Nova Scotia"], NT: ["NT", "Northwest Territories"], NU: ["NU", "Nunavut"],
  ON: ["ON", "Ontario"], PE: ["PE", "Prince Edward Island"], QC: ["QC", "Quebec"],
  SK: ["SK", "Saskatchewan"], YT: ["YT", "Yukon"],
};
type NtpFeature = {
  attributes?: Record<string, string | number | null>;
  geometry?: { x?: number; y?: number };
};
type NtpResponse = { features?: NtpFeature[]; exceededTransferLimit?: boolean; error?: { message?: string } };

const text = (v: unknown) => v == null ? "" : String(v).trim();
const numeric = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const count = (v: unknown) => Math.max(0, Math.round(numeric(v) ?? 0));
const pad = (n: number) => String(n).padStart(2, "0");

function mapFeature(feature: NtpFeature): Tornado | null {
  const a = feature.attributes ?? {};
  const lat = numeric(feature.geometry?.y);
  const lon = numeric(feature.geometry?.x);
  const year = numeric(a.Year);
  const month = numeric(a.month);
  const day = numeric(a.day);
  const id = text(a.objectid ?? a.OBJECTID);
  const rawProvince = text(a.province);
  const provincePair = PROVINCES[rawProvince.toUpperCase()] ?? Object.values(PROVINCES).find(([, name]) => name.toLowerCase() === rawProvince.toLowerCase());
  const province = provincePair?.[0] ?? rawProvince;
  const provinceName = provincePair?.[1] ?? rawProvince;
  if (lat == null || lon == null || year == null || month == null || day == null || !id || !province) return null;

  const damage = text(a.damage);
  const ratingMatch = /(?:ef|f)\s*([0-5])/i.exec(damage);
  const mag = ratingMatch ? Number(ratingMatch[1]) : null;
  const time = text(a.time) || text(a.timeUTC) || "";
  const rawDate = text(a._date);
  const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : `${year}-${pad(month)}-${pad(day)}`;
  const description = text(a.location_description);
  const title = text(a.event_name);
  const lengthKm = numeric(a.track_length);
  const widthM = numeric(a.max_path_width);
  const fatalities = numeric(a.fatalities_text);

  return {
    id: `NTP-${id}`, om: `NTP-${id}`, year, month, day, date, time,
    tz: text(a.timezone) || "local time", country: "Canada", state: province,
    state_name: provinceName, counties: description ? [description] : [],
    mag, scale: "EF", rating: mag == null ? "Unrated" : `EF${mag}`,
    injuries: count(a.injuries), fatalities: count(fatalities), damage_usd: null,
    damage_category: damage || null, start_lat: lat, start_lon: lon,
    end_lat: null, end_lon: null,
    length_mi: lengthKm == null || lengthKm <= 0 ? null : lengthKm * 0.621371,
    width_yd: widthM == null || widthM <= 0 ? null : widthM * 1.09361,
    states_crossed: 1, wiki_title: title || null, thumbnail: null, outbreak: null,
  };
}

/** Public NTP event summaries; only confirmed land and water tornadoes are included. */
export async function loadCanadaNtpTornadoes(): Promise<Tornado[]> {
  const records: Tornado[] = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      where: "event_type IN ('tornado_over_land','tornado_over_water')",
      outFields: "*", returnGeometry: "true", outSR: "4326",
      orderByFields: "Year ASC,objectid ASC", resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE), f: "json",
    });
    const response = await fetch(`${LAYER_URL}?${params}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`NTP Canada tornado feed failed (${response.status})`);
    const data = await response.json() as NtpResponse;
    if (data.error) throw new Error(data.error.message || "NTP Canada tornado feed returned an error");
    const features = data.features ?? [];
    records.push(...features.map(mapFeature).filter((t): t is Tornado => t != null));
    if (features.length < PAGE_SIZE && !data.exceededTransferLimit) break;
    offset += features.length;
    if (!features.length) break;
  }
  return records;
}

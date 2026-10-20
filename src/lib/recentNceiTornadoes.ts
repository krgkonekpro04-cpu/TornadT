import type { Tornado } from "./types";
import { US_STATES } from "./meteo";

const CACHE_KEY = "tornadt.ncei-tornadoes.v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const stateCodes = new Map(US_STATES.map(([code, name]) => [name.toUpperCase(), code]));
type Saved = { checkedAt: number; sourceFile: string; records: Tornado[] };

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const numeric = (v: string | undefined) => v == null || v === "" ? null : Number(v);
const amount = (a: string | undefined, b: string | undefined) => (Number(a) || 0) + (Number(b) || 0);

function parseNcei(text: string): Tornado[] {
  const rows = csvRows(text);
  const header = rows.shift()?.map((x) => x.trim().toLowerCase()) ?? [];
  const index = new Map(header.map((name, i) => [name, i]));
  const records: Tornado[] = [];
  const value = (cells: string[], name: string) => cells[index.get(name) ?? -1]?.trim() ?? "";
  for (const cells of rows) {
    if (value(cells, "event_type").toLowerCase() !== "tornado") continue;
    const dateText = value(cells, "begin_date_time");
    const dateParts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dateText);
    const year = Number(value(cells, "year")) || Number(dateParts?.[3]);
    const month = Number(value(cells, "begin_yearmonth").slice(-2)) || Number(dateParts?.[1]);
    const day = Number(value(cells, "begin_day")) || Number(dateParts?.[2]);
    const stateName = value(cells, "state");
    const state = stateCodes.get(stateName.toUpperCase());
    const startLat = numeric(value(cells, "begin_lat")), startLon = numeric(value(cells, "begin_lon"));
    if (!year || !month || !day || !state || startLat == null || startLon == null) continue;
    const fips = value(cells, "cz_fips");
    const county = value(cells, "cz_name");
    const rating = value(cells, "tor_f_scale").toUpperCase();
    const magMatch = /^(?:E?F)([0-5])$/.exec(rating);
    const mag = magMatch ? Number(magMatch[1]) : null;
    const hhmm = value(cells, "begin_time").padStart(4, "0");
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    records.push({
      id: `NCEI-${value(cells, "event_id")}`, om: value(cells, "event_id"), year, month, day, date,
      time: `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00`, tz: value(cells, "cz_timezone") || "local time",
      country: "United States", state, state_name: stateName.replace(/\b\w/g, (c) => c.toUpperCase()),
      counties: county ? [county.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())] : fips ? [`FIPS ${value(cells, "state_fips").padStart(2, "0")}-${fips.padStart(3, "0")}`] : [],
      mag, scale: rating.startsWith("F") && !rating.startsWith("EF") ? "F" : "EF", rating: mag == null ? "Unknown" : `${rating.startsWith("F") && !rating.startsWith("EF") ? "F" : "EF"}${mag}`,
      injuries: amount(value(cells, "injuries_direct"), value(cells, "injuries_indirect")),
      fatalities: amount(value(cells, "deaths_direct"), value(cells, "deaths_indirect")),
      damage_usd: null, damage_category: null, start_lat: startLat, start_lon: startLon,
      end_lat: numeric(value(cells, "end_lat")), end_lon: numeric(value(cells, "end_lon")),
      length_mi: numeric(value(cells, "tor_length")), width_yd: numeric(value(cells, "tor_width")),
      states_crossed: 1, wiki_title: null, thumbnail: null, outbreak: null,
    });
  }
  return records;
}

function readCache(): Saved | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as Saved | null;
    return cached && Array.isArray(cached.records) ? cached : null;
  } catch { return null; }
}

async function fetchLatestNcei(): Promise<Saved> {
  const indexResponse = await fetch("/noaa-storm-events/csvfiles/", { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!indexResponse.ok) throw new Error(`NOAA NCEI archive unavailable (${indexResponse.status})`);
  const html = await indexResponse.text();
  const files = [...html.matchAll(/StormEvents_details-ftp_v1\.0_d2026_c(\d{8})\.csv\.gz/g)].map((m) => ({ name: m[0], date: m[1] })).sort((a, b) => b.date.localeCompare(a.date));
  if (!files.length) throw new Error("NOAA NCEI has not published a 2026 storm-events file yet");
  const cached = readCache();
  if (cached?.sourceFile === files[0].name) {
    const fresh = { ...cached, checkedAt: Date.now() };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch { /* Cache is optional. */ }
    return fresh;
  }
  const response = await fetch(`/noaa-storm-events/csvfiles/${files[0].name}`, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!response.ok) throw new Error(`NOAA NCEI tornado records unavailable (${response.status})`);
  const bytes = await response.arrayBuffer();
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const csv = await new Response(stream).text();
  const saved: Saved = { checkedAt: Date.now(), sourceFile: files[0].name, records: parseNcei(csv) };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(saved)); } catch { /* Cache is optional. */ }
  return saved;
}

export async function loadRecentNceiTornadoes(): Promise<Tornado[]> {
  const cached = readCache();
  if (cached && Date.now() - cached.checkedAt < DAY_MS) return cached.records;
  try { return (await fetchLatestNcei()).records; }
  catch { return cached?.records ?? []; }
}

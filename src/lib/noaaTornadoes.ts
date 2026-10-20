import type { MapResponse, Stats, Tornado, TornadoPage } from "./types";
import { US_STATES } from "./meteo";
import { loadRecentNceiTornadoes } from "./recentNceiTornadoes";
import { loadCanadaNtpTornadoes } from "./canadaNtpTornadoes";

const stateNames = new Map(US_STATES);
const knownArticleByOm = new Map<string, string>([["1305311703-01", "2013 El Reno tornado"]]);
let datasetPromise: Promise<Tornado[]> | null = null;

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value); value = "";
    } else value += char;
  }
  values.push(value);
  return values;
}

const number = (v: string | undefined) => v == null || v === "" ? null : Number(v);
const positive = (v: number | null) => v != null && Number.isFinite(v) && v > 0 ? v : null;
const coordinate = (v: number | null) => v != null && Number.isFinite(v) && v !== 0 ? v : null;

export function loadNoaaTornadoes(): Promise<Tornado[]> {
  if (!datasetPromise) {
    datasetPromise = (async () => {
      const response = await fetch("/data/1950-2025_actual_tornadoes.csv", { headers: { Accept: "text/csv" } });
      if (!response.ok) throw new Error(`NOAA SPC tornado database failed (${response.status})`);
      const csv = await response.text();
      const lines = csv.trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error("NOAA SPC tornado database is empty");
      const headers = splitCsvLine(lines[0]);
      const col = new Map(headers.map((name, i) => [name, i]));
      const get = (values: string[], key: string) => values[col.get(key) ?? -1] ?? "";
      const records: Tornado[] = [];
      for (let row = 1; row < lines.length; row++) {
        if (!lines[row]) continue;
        const cells = splitCsvLine(lines[row]);
        const year = Number(get(cells, "yr"));
        const magRaw = number(get(cells, "mag"));
        const mag = magRaw != null && magRaw >= 0 ? magRaw : null;
        const state = get(cells, "st").trim();
        const stateFips = get(cells, "stf").padStart(2, "0");
        const countyFips = ["f1", "f2", "f3", "f4"].map((key) => get(cells, key)).filter((v) => v && v !== "0");
        const startLat = number(get(cells, "slat"));
        const startLon = number(get(cells, "slon"));
        if (!Number.isFinite(year) || !state || startLat == null || startLon == null) continue;
        const ratingScale = year >= 2007 ? "EF" : "F";
        const id = `SPC-${year}-${get(cells, "om")}-${row}`;
        const om = get(cells, "om").trim();
        records.push({
          id, om, year,
          month: Number(get(cells, "mo")), day: Number(get(cells, "dy")),
          date: get(cells, "date"), time: get(cells, "time"), tz: "local time",
          country: "United States", state, state_name: stateNames.get(state) ?? state,
          counties: countyFips.map((fips) => `FIPS ${stateFips}-${fips.padStart(3, "0")}`),
          mag, scale: ratingScale, rating: mag == null ? "Unknown" : `${ratingScale}${mag}`,
          injuries: Math.max(0, Number(get(cells, "inj")) || 0),
          fatalities: Math.max(0, Number(get(cells, "fat")) || 0),
          damage_usd: null, damage_category: null,
          start_lat: startLat, start_lon: startLon,
          end_lat: coordinate(number(get(cells, "elat"))), end_lon: coordinate(number(get(cells, "elon"))),
          length_mi: positive(number(get(cells, "len"))), width_yd: positive(number(get(cells, "wid"))),
          states_crossed: Math.max(1, Number(get(cells, "ns")) || 1),
          wiki_title: knownArticleByOm.get(om) ?? null, thumbnail: null, outbreak: null,
        });
      }
      if (!records.length) throw new Error("Could not read NOAA SPC tornado records");
      const recentRecords = await loadRecentNceiTornadoes();
      records.push(...recentRecords);
      // Keep the bundled U.S. SPC/NCEI dataset intact and append international
      // records from their own attributed source files.
      const internationalResponse = await fetch("/data/international/japan-jma-tornadoes.json", { headers: { Accept: "application/json" } });
      if (internationalResponse.ok) {
        const international = await internationalResponse.json() as Tornado[];
        records.push(...international);
      }
      // Canada's public NTP dashboard provides a no-key live feed from the 2017
      // project era. Keep the rest of the historical database usable if it is down.
      try {
        records.push(...await loadCanadaNtpTornadoes());
      } catch (error) {
        console.warn("Could not load Canada's NTP tornado records", error);
      }
      return records;
    })().catch((error) => { datasetPromise = null; throw error; });
  }
  return datasetPromise;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function filterTornadoes(records: Tornado[], params: Record<string, string>, searchPlaces: Array<{ latitude: number; longitude: number }> = []): Tornado[] {
  const ratings = new Set((params.ratings ?? "").split(",").filter(Boolean));
  const q = params.q?.trim().toLowerCase();
  return records.filter((t) => {
    if (params.country && t.country !== params.country) return false;
    if (params.state && t.state !== params.state) return false;
    if (params.year && t.year !== Number(params.year)) return false;
    if (params.start_date && t.date < params.start_date) return false;
    if (params.end_date && t.date > params.end_date) return false;
    if (ratings.size && !ratings.has(t.mag == null ? "U" : String(t.mag))) return false;
    if (params.min_fatalities && t.fatalities < Number(params.min_fatalities)) return false;
    if (params.min_injuries && t.injuries < Number(params.min_injuries)) return false;
    if (params.min_length && (t.length_mi == null || t.length_mi < Number(params.min_length))) return false;
    if (params.max_length && (t.length_mi == null || t.length_mi > Number(params.max_length))) return false;
    if (q) {
      const direct = `${t.country} ${t.state} ${t.state_name} ${t.id} ${t.om} ${t.date} ${t.year} ${t.rating} ${t.counties.join(" ")}`.toLowerCase().includes(q);
      const nearby = searchPlaces.some((place) => distanceKm(t.start_lat, t.start_lon, place.latitude, place.longitude) <= 50);
      if (!direct && !nearby) return false;
    }
    return true;
  });
}

export function tornadoPage(records: Tornado[], params: Record<string, string>, searchPlaces: Array<{ latitude: number; longitude: number }> = []): TornadoPage {
  const filtered = filterTornadoes(records, params, searchPlaces);
  const sortKey = params.sort ?? "date";
  const order = params.order === "asc" ? 1 : -1;
  const val = (t: Tornado): number | string => sortKey === "rating" ? (t.mag ?? -1)
    : sortKey === "fatalities" ? t.fatalities : sortKey === "injuries" ? t.injuries
      : sortKey === "length" ? (t.length_mi ?? -1) : sortKey === "width" ? (t.width_yd ?? -1) : t.date;
  filtered.sort((a, b) => {
    const av = val(a); const bv = val(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * order || a.id.localeCompare(b.id);
  });
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.page_size) || 25));
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, page_size: pageSize };
}

export function tornadoMap(records: Tornado[], params: Record<string, string>, searchPlaces: Array<{ latitude: number; longitude: number }> = []): MapResponse {
  const filtered = filterTornadoes(records, params, searchPlaces);
  const items = filtered.slice().sort((a, b) => (b.mag ?? -1) - (a.mag ?? -1) || b.fatalities - a.fatalities).slice(0, 8000);
  return {
    items: items.map(({ id, rating, mag, date, state, fatalities, injuries, start_lat, start_lon, end_lat, end_lon, length_mi, wiki_title }) =>
      ({ id, rating, mag, date, state, fatalities, injuries, start_lat, start_lon, end_lat, end_lon, length_mi, wiki_title })),
    total: filtered.length,
    truncated: filtered.length > items.length,
  };
}

export function tornadoStats(records: Tornado[], params: Record<string, string>): Stats {
  const data = filterTornadoes(records, params);
  const years = new Map<number, { count: number; fatalities: number; injuries: number }>();
  const months = new Map<number, number>();
  const states = new Map<string, { count: number; fatalities: number; name: string }>();
  const ratings = new Map<string, number>();
  let lengthTotal = 0, lengthN = 0, widthTotal = 0, widthN = 0;
  for (const t of data) {
    const y = years.get(t.year) ?? { count: 0, fatalities: 0, injuries: 0 };
    y.count++; y.fatalities += t.fatalities; y.injuries += t.injuries; years.set(t.year, y);
    months.set(t.month, (months.get(t.month) ?? 0) + 1);
    const s = states.get(t.state) ?? { count: 0, fatalities: 0, name: t.state_name };
    s.count++; s.fatalities += t.fatalities; states.set(t.state, s);
    // F-scale (pre-2007) and EF-scale ratings are binned together by strength;
    // preserve the scale distinction on each individual tornado record.
    const label = t.mag == null ? "Unknown" : `(E)F${t.mag}`;
    ratings.set(label, (ratings.get(label) ?? 0) + 1);
    if (t.length_mi != null) { lengthTotal += t.length_mi; lengthN++; }
    if (t.width_yd != null) { widthTotal += t.width_yd; widthN++; }
  }
  const byYear = [...years].map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year - b.year);
  const byMonth = [...months].map(([month, count]) => ({ month, count })).sort((a, b) => a.month - b.month);
  const byState = [...states].map(([state, v]) => ({ state, state_name: v.name, count: v.count, fatalities: v.fatalities })).sort((a, b) => b.count - a.count);
  const ranked = (key: "length_mi" | "width_yd", limit = 1) => data.filter((t) => t[key] != null).sort((a, b) => b[key]! - a[key]!).slice(0, limit);
  return {
    total: data.length,
    fatalities: data.reduce((n, t) => n + t.fatalities, 0),
    injuries: data.reduce((n, t) => n + t.injuries, 0),
    avg_length_mi: lengthN ? lengthTotal / lengthN : null,
    avg_width_yd: widthN ? widthTotal / widthN : null,
    longest: ranked("length_mi")[0] ?? null,
    widest: ranked("width_yd")[0] ?? null,
    deadliest: data.filter((t) => t.fatalities > 0).sort((a, b) => b.fatalities - a.fatalities).slice(0, 10),
    by_rating: [...ratings].map(([label, count]) => ({ label, count })).sort((a, b) => {
      const am = /\d/.exec(a.label), bm = /\d/.exec(b.label);
      if (!am) return 1;
      if (!bm) return -1;
      return Number(am[0]) - Number(bm[0]);
    }),
    by_year: byYear, by_month: byMonth, by_state: byState,
    min_date: data.reduce<string | null>((d, t) => d == null || t.date < d ? t.date : d, null),
    max_date: data.reduce<string | null>((d, t) => d == null || t.date > d ? t.date : d, null),
  };
}

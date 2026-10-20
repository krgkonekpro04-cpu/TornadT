import type { Alert, GridResponse, Profile, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./units";
import { loadNoaaTornadoes } from "./noaaTornadoes";

// The original hosted API is no longer needed. TornadT keeps the profile on this
// device and reads live products from their public providers.
const PROFILE_KEY = "tornadt.profile.v1";
const freshProfile = (): Profile => ({ settings: { ...DEFAULT_SETTINGS }, favorite_tornadoes: [], locations: [], saved_searches: [] });
function readProfile(): Profile {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as Partial<Profile> | null;
    return { ...freshProfile(), ...value, settings: { ...DEFAULT_SETTINGS, ...value?.settings }, favorite_tornadoes: value?.favorite_tornadoes ?? [], locations: value?.locations ?? [], saved_searches: value?.saved_searches ?? [] };
  } catch { return freshProfile(); }
}
function saveProfile(profile: Profile): Profile { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); return profile; }
async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/geo+json, application/json" } });
  if (!response.ok) throw new Error("Public data request failed (" + response.status + ")");
  return response.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const [route, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  if (route === "/profile") return readProfile() as T;
  if (route === "/alerts") {
    const p = new URLSearchParams({ limit: "500" });
    if (params.get("status") !== "all") p.set("active", "true");
    if (params.get("area")) p.set("area", params.get("area")!);
    const data = await json<{ features?: Array<{ id?: string; properties: Record<string, unknown>; geometry?: Alert["geometry"] }> }>("/nws/alerts?" + p);
    const items: Alert[] = (data.features ?? []).map(({ id, properties: v, geometry }) => ({
      id: String(id ?? v.id ?? ""), event: String(v.event ?? "Weather alert"), severity: String(v.severity ?? "Unknown"), urgency: String(v.urgency ?? "Unknown"), certainty: String(v.certainty ?? "Unknown"), status: String(v.status ?? "Actual"), message_type: String(v.messageType ?? "Alert"), sender_name: String(v.senderName ?? "National Weather Service"), area_desc: String(v.areaDesc ?? ""), sent: String(v.sent ?? "") || null, effective: String(v.effective ?? "") || null, onset: String(v.onset ?? "") || null, expires: String(v.expires ?? "") || null, ends: String(v.ends ?? "") || null, headline: String(v.headline ?? "") || null, description: String(v.description ?? "") || null, instruction: String(v.instruction ?? "") || null, geometry: geometry ?? null, source_url: String(v.web ?? v["@id"] ?? "https://api.weather.gov/alerts"), is_active: Boolean(new Date(String(v.expires ?? 0)).getTime() > Date.now()), category: String(v.category ?? ""),
    }));
    return { items, fetched_at: new Date().toISOString(), source: "U.S. National Weather Service", coverage_note: "U.S. alerts only. For immediate safety information, follow your local meteorological service." } as T;
  }
  if (route === "/wiki") {
    const title = params.get("title") ?? "";
    return loadTornadoArticle(title) as Promise<T>;
  }
  if (route === "/tornado-media") {
    return loadTornadoMedia(params) as Promise<T>;
  }
  if (route === "/outbreaks") {
    const records = await loadNoaaTornadoes();
    const byDay = new Map<string, typeof records>();
    for (const record of records) byDay.set(record.date, [...(byDay.get(record.date) ?? []), record]);
    const events = [...byDay].map(([date, tornadoes]) => {
      const violent = tornadoes.filter((t) => (t.mag ?? -1) >= 4);
      return { id: "SPC-" + date, title: new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + " tornado outbreak", wiki_title: null, start_date: date, end_date: date, year: Number(date.slice(0, 4)), extract: tornadoes.length + " recorded tornadoes across " + [...new Set(tornadoes.map((t) => t.state_name))].join(", ") + ".", thumbnail: null, count: tornadoes.length, fatalities: tornadoes.reduce((n, t) => n + t.fatalities, 0), injuries: tornadoes.reduce((n, t) => n + t.injuries, 0), violent: violent.length };
    }).filter((event) => event.count >= 10 || event.violent >= 4 || event.fatalities >= 5).sort((a, b) => b.violent - a.violent || b.fatalities - a.fatalities || b.count - a.count).slice(0, 150);
    return events as T;
  }
  if (route === "/weather/grid") {
    const south = Number(params.get("south")), west = Number(params.get("west"));
    const north = Number(params.get("north")), east = Number(params.get("east"));
    const dlat = Math.max(0.5, Math.ceil((north - south) / 8 * 4) / 4);
    const dlon = Math.max(0.5, Math.ceil((east - west) / 8 * 4) / 4);
    const locations: Array<{ lat: number; lon: number }> = [];
    for (let lat = south + dlat / 2; lat < north && locations.length < 81; lat += dlat) for (let lon = west + dlon / 2; lon < east && locations.length < 81; lon += dlon) {
      locations.push({ lat: Number(lat.toFixed(3)), lon: Number(lon.toFixed(3)) });
    }
    const query = new URLSearchParams({ latitude: locations.map((p) => p.lat).join(","), longitude: locations.map((p) => p.lon).join(","), current: "temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation", timezone: "UTC" });
    const raw = await json<Array<{ current?: Record<string, number | string | null>; current_units?: Record<string, string> }> | { current?: Record<string, number | string | null>; current_units?: Record<string, string> }>("/open-meteo/v1/forecast?" + query);
    const values = Array.isArray(raw) ? raw : [raw];
    const cellData = values.map((place, i) => {
      const c = place.current ?? {};
      return { ...locations[i], temperature: Number(c.temperature_2m ?? NaN), wind_speed: Number(c.wind_speed_10m ?? NaN), wind_direction: Number(c.wind_direction_10m ?? NaN), cloud_cover: Number(c.cloud_cover ?? NaN), precipitation: Number(c.precipitation ?? NaN) };
    }).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && Number.isFinite(c.temperature));
    const result: GridResponse = { cells: cellData, dlat, dlon, fetched_at: new Date().toISOString(), model_time: null, source: "Open-Meteo model forecast" };
    return result as T;
  }
  throw new Error("Unknown local data route: " + route);
}

type MwImage = { title: string; pageid?: number; imageinfo?: Array<{ url: string; thumburl?: string; width: number; height: number; extmetadata?: Record<string, { value?: string }> }> };
const stripHtml = (s?: string) => s ? new DOMParser().parseFromString(s, "text/html").body.textContent?.trim() ?? null : null;
const field = (meta: Record<string, { value?: string }> | undefined, key: string) => stripHtml(meta?.[key]?.value);
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Nominatim asks applications to stay at or below one reverse-geocode request
// per second. Gallery items become visible in batches, so serialize that source
// instead of triggering a burst that it will throttle.
let reverseGeocodeQueue: Promise<unknown> = Promise.resolve();
let lastReverseGeocodeAt = 0;
function reverseGeocode(url: string) {
  const request = reverseGeocodeQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastReverseGeocodeAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastReverseGeocodeAt = Date.now();
    return json<{ address?: Record<string, string>; name?: string }>(url);
  });
  reverseGeocodeQueue = request.catch(() => undefined);
  return request;
}
function isTornadoPhoto(title: string, description: string | null) {
  const text = normalized(`${title} ${description ?? ""}`);
  if (!/\b(tornado|funnel cloud)\b/.test(text)) return false;
  return !/\b(map|chart|diagram|graph|radar|outlook|probability|forecast|warning|track|path|logo|flag|seal|icon|illustration|drawing|aftermath|rescue|relief|cleanup|clean up|recovery|volunteer|helping|helped|basketball|nba|player|debris|wreckage|victim|memorial|damage|damaged|damage survey|destruction|destroyed|rebuild|donation|shelter|collapsed|ruins|cleanup crew|reconstruction)\b/.test(text);
}

function commonsImage(page: MwImage) {
  const ii = page.imageinfo?.[0];
  if (!ii?.url || !ii.thumburl) return null;
  const m = ii.extmetadata;
  const license = field(m, "LicenseShortName");
  if (!license) return null;
  const description = field(m, "ImageDescription") ?? field(m, "Credit");
  if (!isTornadoPhoto(page.title, description)) return null;
  const title = page.title.replace(/^File:/, "");
  return { title, url: ii.url, thumb: ii.thumburl, width: ii.width, height: ii.height, artist: field(m, "Artist"), license, license_url: field(m, "LicenseUrl"), description, source_page: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")) };
}

async function loadTornadoArticle(title: string) {
  const api = new URLSearchParams({ action: "query", prop: "extracts|pageimages|info|images", exintro: "1", explaintext: "1", piprop: "thumbnail", pithumbsize: "1200", inprop: "url", imlimit: "40", titles: title, format: "json", origin: "*" });
  const result = await json<{ query?: { pages?: Record<string, { title: string; missing?: string; extract?: string; thumbnail?: { source: string }; fullurl?: string; images?: Array<{ title: string }> }> } }>("https://en.wikipedia.org/w/api.php?" + api);
  const page = Object.values(result.query?.pages ?? {})[0];
  if (!page || page.title === "" || page.missing != null) throw new Error("Wikipedia article not found");
  const files = (page.images ?? []).map((i) => i.title).filter((s) => /\.(?:jpe?g|png|webp)$/i.test(s)).slice(0, 25);
  const images = files.length ? await commonsImages(files) : [];
  let description: string | null = null;
  try {
    const summary = await json<{ description?: string }>("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(page.title));
    description = summary.description ?? null;
  } catch { /* The article extract is still useful without the short description. */ }
  // Wikipedia's page thumbnail may be a damage or aftermath image. Only use a
  // Commons file after the same subject check used by the event photo gallery.
  return { title: page.title, description, extract: page.extract ?? null, url: page.fullurl ?? wikiUrl(page.title), thumbnail: images[0]?.thumb ?? null, lead_image: images[0] ?? null, images };
}

function wikiUrl(title: string) { return "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")); }

async function commonsImages(titles: string[]) {
  const p = new URLSearchParams({ action: "query", titles: titles.join("|"), prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1200", iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|ImageDescription|Credit", format: "json", origin: "*" });
  const data = await json<{ query?: { pages?: Record<string, MwImage> } }>("https://commons.wikimedia.org/w/api.php?" + p);
  return Object.values(data.query?.pages ?? {}).flatMap((page) => {
    const image = commonsImage(page);
    return image ? [image] : [];
  });
}

async function loadTornadoMedia(params: URLSearchParams) {
  const id = params.get("id") ?? "";
  const cacheKey = `tornadt.media.v7.${id}`;
  try {
    const saved = localStorage.getItem(cacheKey);
    if (saved) {
      const cached = JSON.parse(saved) as { cached_at?: number; images?: unknown[] };
      const ttl = cached.images?.length ? 30 * 24 * 60 * 60_000 : 24 * 60 * 60_000;
      if (cached.cached_at && Date.now() - cached.cached_at < ttl) return cached;
    }
  } catch { /* Ignore a damaged or expired local cache. */ }
  const year = params.get("year") ?? "", state = params.get("state") ?? "", lat = params.get("lat") ?? "", lon = params.get("lon") ?? "";
  const articleTitle = params.get("title") ?? "";
  let place = "";
  let countyName = "";
  try {
    const geo = await reverseGeocode(`/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=jsonv2&addressdetails=1&zoom=10&layer=address`);
    const a = geo.address ?? {};
    countyName = a.county ?? "";
    place = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county ?? geo.name ?? "";
  } catch { /* NOAA county/state remain available as a fallback. */ }
  const county = params.get("county") ?? "";
  if (!place || /^FIPS\b/i.test(place)) place = county && !/^FIPS\b/i.test(county) ? county : state;
  const eventName = `${year} ${place} tornado`;
  let article: Awaited<ReturnType<typeof loadTornadoArticle>> | null = null;
  const placeWords = normalized(place).split(" ").filter((w) => w.length > 2);
  const hasSpecificPlace = normalized(place) !== normalized(state) && placeWords.length > 0;
  if (articleTitle) {
    try { article = await loadTornadoArticle(articleTitle); } catch { /* Use verified Commons media and descriptive name. */ }
  }
  if (!article && hasSpecificPlace) {
    try {
      const searchPlace = countyName || place;
      const countyTokens = normalized(searchPlace).split(" ").filter((w) => w.length > 2);
      const q = new URLSearchParams({ action: "query", list: "search", srsearch: `"${searchPlace}" ${state} ${year} tornado`, srprop: "snippet", srlimit: "12", format: "json", origin: "*" });
      const found = await json<{ query?: { search?: Array<{ title: string; snippet?: string }> } }>("https://en.wikipedia.org/w/api.php?" + q);
      const candidates = (found.query?.search ?? []).filter((x) => {
        const n = normalized(x.title);
        return n.includes("tornado") && n.includes(year) && !/\b(outbreak|list|tornadoes of)\b/.test(n);
      });
      const match = candidates.find((x) => {
        const n = normalized(x.title);
        return placeWords.some((w) => n.includes(w));
      }) ?? candidates.find((x) => {
        const excerpt = normalized((x.snippet ?? "").replace(/<[^>]*>/g, " "));
        return countyTokens.length > 1 && countyTokens.every((w) => excerpt.includes(w));
      });
      if (match) article = await loadTornadoArticle(match.title);
    } catch { /* Keep a location-based name and try the Commons image search independently. */ }
  }
  let images = [...(article?.images ?? [])];
  if (articleTitle || hasSpecificPlace) {
    const searchTerms = [...new Set([
      article?.title,
      hasSpecificPlace ? `${place} ${year} tornado` : "",
      countyName && countyName !== place ? `${countyName} ${state} ${year} tornado` : "",
    ].filter((term): term is string => !!term))];
    const results = await Promise.allSettled(searchTerms.map(async (term) => {
      const search = new URLSearchParams({ action: "query", generator: "search", gsrsearch: term, gsrnamespace: "6", gsrlimit: "30", prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1200", iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|ImageDescription|Credit", format: "json", origin: "*" });
      const data = await json<{ query?: { pages?: Record<string, MwImage> } }>("https://commons.wikimedia.org/w/api.php?" + search);
      const queryWords = normalized(term).split(" ").filter((w) => w.length > 2 && w !== "tornado");
      return Object.values(data.query?.pages ?? {}).filter((page) => {
        const text = normalized(`${page.title} ${field(page.imageinfo?.[0]?.extmetadata, "ImageDescription") ?? ""}`);
        const matchesEvent = queryWords.some((word) => word !== year && text.includes(word));
        const exactArticleSearch = !!article && term === article.title;
        return /\b(tornado|funnel cloud)\b/.test(text) && matchesEvent && (!year || text.includes(year) || exactArticleSearch);
      }).flatMap((page) => {
        const image = commonsImage(page);
        return image ? [image] : [];
      });
    }));
    for (const result of results) if (result.status === "fulfilled") images.push(...result.value);
  }
  images = [...new Map(images.map((image) => [image.url, image])).values()].slice(0, 60);
  const data = { event_name: article?.title ?? eventName, place, article: article ?? null, images, cached_at: Date.now() };
  try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* Cache is optional. */ }
  return data;
}

async function mutate<T>(method: string, path: string, body?: unknown): Promise<T> {
  const p = readProfile();
  const parts = path.split("/").filter(Boolean);
  const area = parts[1];
  if (area === "settings" && method === "PUT") p.settings = { ...p.settings, ...(body as Settings) };
  else if (area === "favorites") {
    const id = parts[2]!;
    p.favorite_tornadoes = method === "DELETE" ? p.favorite_tornadoes.filter((x) => x !== id) : [...new Set([...p.favorite_tornadoes, id])];
  } else if (area === "locations" && method === "POST") {
    const v = body as Omit<Profile["locations"][number], "id">;
    p.locations.push({ ...v, id: crypto.randomUUID() });
  } else if (area === "locations" && method === "DELETE") p.locations = p.locations.filter((x) => x.id !== parts[2]);
  else if (area === "searches" && method === "POST") {
    const v = body as { name: string; params: Record<string, string> };
    p.saved_searches.push({ ...v, id: crypto.randomUUID(), created_at: new Date().toISOString() });
  } else if (area === "searches" && method === "DELETE") p.saved_searches = p.saved_searches.filter((x) => x.id !== parts[2]);
  else throw new Error("Unknown local profile action: " + method + " " + path);
  return saveProfile(p) as T;
}

export const apiGet = <T>(path: string) => get<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => mutate<T>("POST", path, body);
export const apiPut = <T>(path: string, body?: unknown) => mutate<T>("PUT", path, body);
export const apiPatch = <T>(path: string, body?: unknown) => mutate<T>("PATCH", path, body);
export const apiDelete = <T>(path: string) => mutate<T>("DELETE", path);

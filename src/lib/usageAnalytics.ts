const enabledKey = "tornadt_usage_analytics_enabled";
const distinctIdKey = "tornadt_usage_analytics_id";
const sessionKey = "tornadt_usage_analytics_session";
const activeIntervalMs = 5 * 60 * 1000;

const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
const apiHost = (import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/$/, "");
let activeTimer: number | undefined;

function isEnabled() {
  try { return localStorage.getItem(enabledKey) === "true"; }
  catch { return false; }
}

function getDistinctId() {
  let id = localStorage.getItem(distinctIdKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(distinctIdKey, id);
  }
  return id;
}

function capture(event: "tornadt_app_opened" | "tornadt_app_active") {
  if (!projectToken || !isEnabled()) return;
  const payload = {
    api_key: projectToken,
    event,
    distinct_id: getDistinctId(),
    properties: {
      app: "TornadT",
      platform: navigator.platform || "unknown",
      $geoip_disable: true,
    },
    timestamp: new Date().toISOString(),
  };
  void fetch(`${apiHost}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "omit",
    keepalive: true,
  }).catch(() => {});
}

function start() {
  if (!projectToken || !isEnabled() || activeTimer !== undefined) return;
  if (sessionStorage.getItem(sessionKey) !== "true") {
    capture("tornadt_app_opened");
    sessionStorage.setItem(sessionKey, "true");
  }
  capture("tornadt_app_active");
  activeTimer = window.setInterval(() => capture("tornadt_app_active"), activeIntervalMs);
}

function stop() {
  if (activeTimer !== undefined) window.clearInterval(activeTimer);
  activeTimer = undefined;
}

export function setUsageAnalyticsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(enabledKey, String(enabled));
    window.dispatchEvent(new Event("tornadt-usage-analytics-change"));
  } catch {}
}

export function isUsageAnalyticsEnabled() {
  return isEnabled();
}

export function isUsageAnalyticsConfigured() {
  return Boolean(projectToken);
}

export function initializeUsageAnalytics() {
  start();
  const onChange = () => {
    stop();
    start();
  };
  window.addEventListener("tornadt-usage-analytics-change", onChange);
  return () => {
    stop();
    window.removeEventListener("tornadt-usage-analytics-change", onChange);
  };
}

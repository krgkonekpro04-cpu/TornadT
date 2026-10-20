import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import {
  Activity, BarChart3, Bug, ChevronsLeft, ChevronsRight, CloudSun, Database, GitCompareArrows, History, LayoutDashboard,
  LocateFixed, Loader2, MapPin, Menu, Radar, RefreshCw, Search, Settings as SettingsIcon, ShieldAlert, Star, Tornado as TornadoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useApp } from "@/lib/appState";
import { useAlerts, useGeocode, useRadar } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "./Logo";
import { CompareDialog } from "@/components/tornado/CompareDialog";
import { placeName } from "@/components/common/LocationSearch";
import { BugReportDialog } from "@/components/common/BugReportDialog";
import { initializeUsageAnalytics } from "@/lib/usageAnalytics";

const TornadoDetailPanel = lazy(() => import("@/components/tornado/TornadoDetailPanel").then((m) => ({ default: m.TornadoDetailPanel })));

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/radar", label: "Live Radar", icon: Radar, id: "radar" },
  { to: "/weather", label: "Weather", icon: CloudSun, id: "weather" },
  { to: "/database", label: "Tornado Database", icon: Database, id: "database" },
  { to: "/historical", label: "Historical Events", icon: History, id: "historical" },
  { to: "/alerts", label: "Severe Weather", icon: ShieldAlert, id: "alerts" },
  { to: "/statistics", label: "Statistics", icon: BarChart3, id: "statistics" },
  { to: "/favorites", label: "Favorites", icon: Star, id: "favorites" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, id: "settings" },
];

function NavItems({ collapsed, onNavigate, prefix }: { collapsed: boolean; onNavigate?: () => void; prefix: string }) {
  const { data } = useAlerts("active");
  const tornadoWarnings = data?.items.filter((a) => a.is_active && /tornado warning/i.test(a.event)).length ?? 0;
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          onClick={onNavigate}
          data-testid={`${prefix}-nav-${n.id}`}
          title={collapsed ? n.label : undefined}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-tt-accent",
              isActive ? "bg-tt-accent2/20 text-white" : "text-tt-muted hover:bg-white/5 hover:text-tt-text",
              collapsed && "justify-center px-0",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-tt-accent" />}
              <n.icon className={cn("size-[18px] shrink-0", isActive && "text-tt-accent")} />
              {!collapsed && <span className="truncate">{n.label}</span>}
              {n.id === "alerts" && tornadoWarnings > 0 && (
                <span className={cn("tt-pulse rounded-full bg-tt-red px-1.5 text-[10px] font-bold text-white", collapsed ? "absolute right-1 top-1" : "ml-auto")}>
                  {tornadoWarnings}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { setLocation } = useApp();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setD(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const { data, isFetching } = useGeocode(d);
  const goRecords = () => {
    if (!q.trim()) return;
    nav(`/database?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
    setQ("");
  };
  return (
    <div ref={box} className="relative w-full max-w-md">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-tt-border bg-tt-card px-3 focus-within:border-tt-accent/60">
        <Search className="size-4 text-tt-muted" />
        <input
          data-testid="topbar-search-input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && goRecords()}
          placeholder="Search cities or tornado records (county, state)…"
          aria-label="Global search"
          className="w-full bg-transparent text-sm placeholder:text-tt-muted focus:outline-none"
        />
        {isFetching && <Loader2 className="size-4 animate-spin text-tt-muted" />}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="tt-glass absolute left-0 right-0 top-12 z-[1300] overflow-hidden rounded-lg">
          <button data-testid="topbar-search-records" onMouseDown={(e) => e.preventDefault()} onClick={goRecords} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-white/5">
            <TornadoIcon className="size-4 text-tt-accent" /> Search tornado records for “{q.trim()}”
          </button>
          <div className="tt-label border-t border-tt-border px-3 pb-1 pt-2 !text-[10px]">Places · weather</div>
          {(data ?? []).slice(0, 6).map((g, i) => (
            <button
              key={g.id}
              data-testid={`topbar-search-place-${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setLocation({ name: placeName(g), lat: g.latitude, lon: g.longitude });
                nav("/weather");
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
            >
              <MapPin className="size-3.5 text-tt-lilac" />
              <span className="truncate">{placeName(g)}</span>
            </button>
          ))}
          {!isFetching && data && data.length === 0 && <div className="px-3 py-2 text-xs text-tt-muted">No matching places.</div>}
        </div>
      )}
    </div>
  );
}

function DataStatus() {
  const radar = useRadar();
  const alerts = useAlerts("active");
  const fetching = useIsFetching({ queryKey: ["radar"] }) + useIsFetching({ queryKey: ["alerts", "active"] });
  const ok = !radar.isError && !alerts.isError;
  const last = radar.data ? new Date(radar.data.generated * 1000) : null;
  return (
    <div
      data-testid="topbar-data-status"
      title={`Radar: ${radar.isError ? "unavailable" : "RainViewer"} · Alerts: ${alerts.isError ? "unavailable" : "NWS"}`}
      className="hidden items-center gap-2 rounded-lg border border-tt-border bg-tt-card px-2.5 py-1.5 text-xs text-tt-muted lg:flex"
    >
      <span className={cn("size-2 rounded-full", fetching ? "bg-tt-cyan animate-pulse" : ok ? "bg-emerald-400" : "bg-tt-orange")} />
      <span>{fetching ? "Updating…" : ok ? "Data feeds OK" : "Some feeds unavailable"}</span>
      {last && <span className="tt-mono text-[10px] text-tt-lilac">radar {last.toISOString().slice(11, 16)}Z</span>}
    </div>
  );
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { location, setLocation, compare, setCompareOpen } = useApp();
  const [locating, setLocating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const [introLeaving, setIntroLeaving] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);

  useEffect(() => initializeUsageAnalytics(), []);

  useEffect(() => {
    const leave = window.setTimeout(() => setIntroLeaving(true), 950);
    const remove = window.setTimeout(() => setIntroVisible(false), 1450);
    return () => { window.clearTimeout(leave); window.clearTimeout(remove); };
  }, []);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await qc.invalidateQueries({ predicate: (q) => !["profile", "wiki", "geocode"].includes(String(q.queryKey[0])) });
      toast.success("Latest available data loaded");
    } catch {
      toast.error("Refresh failed. Check your connection and try again.");
    } finally {
      setIsRefreshing(false);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) return toast.error("Geolocation is not supported by this browser");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setLocation({ name: "My location", lat: p.coords.latitude, lon: p.coords.longitude });
        toast.success("Using your current location");
      },
      () => {
        setLocating(false);
        toast.error("Location permission denied or unavailable");
      },
      { timeout: 10000 },
    );
  };

  return (
    <div className="relative flex h-dvh overflow-hidden bg-tt-bg text-tt-text">
      <aside
        data-testid="sidebar"
        className={cn("hidden shrink-0 flex-col border-r border-tt-border bg-tt-bg2 transition-[width] duration-200 ease-out md:flex", collapsed ? "w-[72px]" : "w-60")}
      >
        <div className={cn("flex h-16 items-center border-b border-tt-border px-4", collapsed && "justify-center px-0")}>
          <Logo collapsed={collapsed} />
        </div>
        <div className="tt-scroll flex-1 overflow-y-auto px-3 py-4">
          <NavItems collapsed={collapsed} prefix="sidebar" />
        </div>
        <div className="border-t border-tt-border p-3">
          {!collapsed && <p className="mb-2 px-1 text-[10px] leading-snug text-tt-muted">Track the Storm. Understand the Science.</p>}
          <button
            data-testid="sidebar-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-tt-border py-2 text-xs text-tt-muted transition-colors duration-150 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-72 border-tt-border bg-tt-bg2 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b border-tt-border px-4"><Logo /></div>
          <div className="p-3"><NavItems collapsed={false} prefix="mobile" onNavigate={() => setMobile(false)} /></div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-[1000] flex h-16 shrink-0 items-center gap-2 border-b border-tt-border bg-tt-bg2/95 px-3 backdrop-blur sm:gap-3 sm:px-5">
          <button data-testid="mobile-menu-btn" className="rounded-lg p-2 text-tt-muted hover:text-white md:hidden" onClick={() => setMobile(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div data-testid="topbar-current-location" className="hidden items-center gap-1.5 rounded-lg border border-tt-border bg-tt-card px-2.5 py-1.5 text-xs sm:flex">
              <MapPin className="size-3.5 text-tt-cyan" />
              <span className="max-w-[160px] truncate">{location.name}</span>
              <button data-testid="topbar-locate-btn" onClick={locate} className="ml-1 text-tt-muted hover:text-tt-lilac" aria-label="Use my current location" title="Use my current location">
                {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
              </button>
            </div>
            <DataStatus />
            {compare.length > 0 && (
              <button data-testid="topbar-compare-btn" onClick={() => setCompareOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-tt-accent/50 bg-tt-accent2/20 px-2.5 py-1.5 text-xs text-white">
                <GitCompareArrows className="size-3.5" /> Compare {compare.length}/2
              </button>
            )}
            <button data-testid="topbar-refresh-button" onClick={refresh} disabled={isRefreshing} className="rounded-lg border border-tt-border bg-tt-card p-2 text-tt-muted transition-colors duration-150 hover:text-white disabled:opacity-60" aria-label="Refresh live data" title="Refresh live data">
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
            </button>
            <button data-testid="topbar-report-bug-button" onClick={() => setBugReportOpen(true)} className="rounded-lg border border-tt-border bg-tt-card p-2 text-tt-muted transition-colors duration-150 hover:border-tt-orange/50 hover:text-tt-orange" aria-label="Report a bug" title="Report a bug">
              <Bug className="size-4" />
            </button>
            <button data-testid="topbar-settings-button" onClick={() => nav("/settings")} className="rounded-lg border border-tt-border bg-tt-card p-2 text-tt-muted transition-colors duration-150 hover:text-white" aria-label="Settings" title="Settings">
              <SettingsIcon className="size-4" />
            </button>
            <Activity className="hidden size-4 text-tt-accent xl:block" aria-hidden />
          </div>
        </header>
        <main className="tt-scroll relative min-h-0 flex-1 overflow-y-auto">
          <div key={pathname} className="tt-page-enter min-h-full"><Outlet /></div>
        </main>
        <footer data-testid="app-footer" className="flex h-8 shrink-0 items-center justify-center gap-2 border-t border-tt-border bg-tt-bg2 px-3 text-[10px] tracking-wide text-tt-muted">
          <span>TornadT · v2.0.0</span><span className="text-tt-cyan">•</span><span>Track the Storm</span>
        </footer>
      </div>
      <Suspense fallback={null}><TornadoDetailPanel /></Suspense>
      <CompareDialog />
      <BugReportDialog open={bugReportOpen} onOpenChange={setBugReportOpen} />
      <Toaster position="bottom-right" theme="dark" richColors />
      {introVisible && (
        <div aria-hidden="true" className={cn("tt-intro fixed inset-0 z-[2000] flex items-center justify-center bg-[#07111f]", introLeaving && "tt-intro-leave")}>
          <div className="tt-intro-card flex flex-col items-center gap-4 text-center">
            <LogoMark className="size-24" />
            <div><div className="font-heading text-3xl font-bold tracking-tight">Tornad<span className="text-tt-cyan">T</span></div><div className="mt-1 text-xs tracking-[.2em] text-tt-muted">STORM RADAR · LIVE</div></div>
            <div className="tt-intro-track"><span /></div>
          </div>
        </div>
      )}
    </div>
  );
}

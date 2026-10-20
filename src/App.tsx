import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import AppShell from "@/components/layout/AppShell";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const RadarPage = lazy(() => import("@/pages/Radar"));
const WeatherPage = lazy(() => import("@/pages/Weather"));
const DatabasePage = lazy(() => import("@/pages/Database"));
const HistoricalPage = lazy(() => import("@/pages/Historical"));
const SeverePage = lazy(() => import("@/pages/Severe"));
const StatisticsPage = lazy(() => import("@/pages/Statistics"));
const FavoritesPage = lazy(() => import("@/pages/Favorites"));
const SettingsPage = lazy(() => import("@/pages/Settings"));

function PageLoading() {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-tt-muted"><LoaderCircle className="size-4 animate-spin text-tt-cyan" /> Loading…</div>;
}

function NotFound() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-tt-lilac hover:underline">Back to the dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Suspense fallback={<PageLoading />}><Dashboard /></Suspense>} />
        <Route path="/radar" element={<Suspense fallback={<PageLoading />}><RadarPage /></Suspense>} />
        <Route path="/weather" element={<Suspense fallback={<PageLoading />}><WeatherPage /></Suspense>} />
        <Route path="/database" element={<Suspense fallback={<PageLoading />}><DatabasePage /></Suspense>} />
        <Route path="/historical" element={<Suspense fallback={<PageLoading />}><HistoricalPage /></Suspense>} />
        <Route path="/alerts" element={<Suspense fallback={<PageLoading />}><SeverePage /></Suspense>} />
        <Route path="/statistics" element={<Suspense fallback={<PageLoading />}><StatisticsPage /></Suspense>} />
        <Route path="/favorites" element={<Suspense fallback={<PageLoading />}><FavoritesPage /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<PageLoading />}><SettingsPage /></Suspense>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    proxy: {
      "/geocode": {
        target: "https://geocoding-api.open-meteo.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/geocode/, ""),
      },
      "/open-meteo": {
        target: "https://api.open-meteo.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/open-meteo/, ""),
      },
      "/nws": {
        target: "https://api.weather.gov",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nws/, ""),
      },
      "/reverse-geocode": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/reverse-geocode/, "/reverse"),
      },
      "/noaa-storm-events": {
        target: "https://www.ncei.noaa.gov/pub/data/swdi/stormevents",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/noaa-storm-events/, ""),
      },
      "/radar-index": {
        target: "https://api.rainviewer.com",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/public/weather-maps.json",
      },
      "/tiles/radar": {
        target: "https://tilecache.rainviewer.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tiles\/radar/, ""),
      },
      "/tiles/osm": {
        target: "https://tile.openstreetmap.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tiles\/osm/, ""),
      },
      "^/tiles/esri-dark-labels/": {
        target: "https://server.arcgisonline.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => `/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/${path.replace(/^\/tiles\/esri-dark-labels\/?/, "")}`,
      },
      "^/tiles/esri-satellite/": {
        target: "https://server.arcgisonline.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => `/ArcGIS/rest/services/World_Imagery/MapServer/tile/${path.replace(/^\/tiles\/esri-satellite\/?/, "")}`,
      },
      "^/tiles/esri-reference/": {
        target: "https://server.arcgisonline.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => `/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${path.replace(/^\/tiles\/esri-reference\/?/, "")}`,
      },
      "^/tiles/esri-dark/": {
        target: "https://server.arcgisonline.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => `/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${path.replace(/^\/tiles\/esri-dark\/?/, "")}`,
      },
    },
  },
});

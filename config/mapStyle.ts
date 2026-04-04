// Dark map style for MapLibre using CARTO's free dark-matter basemap
// No API key required for reasonable usage

export const DARK_MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Fallback: inline raster dark style if vector style fails
export const DARK_MAP_STYLE_RASTER = {
  version: 8 as const,
  name: "Dark",
  sources: {
    "carto-dark": {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "carto-dark-layer",
      type: "raster" as const,
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Offline tile pack config defaults
export const OFFLINE_PACK_CONFIG = {
  minZoom: 10,
  maxZoom: 16,
  // ~2km radius around user in degrees (roughly)
  radiusDegrees: 0.02,
};

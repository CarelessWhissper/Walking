/**
 * Build a square-viewBox SVG path from a route, bounds-fit with the smaller
 * axis centered, north up. Shared by the share cards and the History run-card
 * route tiles.
 */
export const ROUTE_VB = 1000;
const ROUTE_PAD = 40;

export function buildRoutePath(
  locations: { latitude: number; longitude: number }[] | undefined,
): string | null {
  if (!locations || locations.length < 2) return null;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const l of locations) {
    if (l.latitude < minLat) minLat = l.latitude;
    if (l.latitude > maxLat) maxLat = l.latitude;
    if (l.longitude < minLon) minLon = l.longitude;
    if (l.longitude > maxLon) maxLon = l.longitude;
  }

  const latRange = Math.max(maxLat - minLat, 1e-6);
  const lonRange = Math.max(maxLon - minLon, 1e-6);
  const range = Math.max(latRange, lonRange);

  // Center the smaller axis within the square viewBox
  const latOffset = (range - latRange) / 2;
  const lonOffset = (range - lonRange) / 2;
  const usable = ROUTE_VB - ROUTE_PAD * 2;

  const points = locations.map((l) => {
    const nx = (l.longitude - minLon + lonOffset) / range;
    const ny = (l.latitude - minLat + latOffset) / range;
    const x = ROUTE_PAD + nx * usable;
    // Invert Y so north is up
    const y = ROUTE_PAD + (1 - ny) * usable;
    return [x, y] as [number, number];
  });

  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
}

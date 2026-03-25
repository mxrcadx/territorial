/**
 * Phase B: Suitability surface computation.
 *
 * Computes favorability (distance to geothermal fields), buildability (slope),
 * and composite suitability from the weighted combination.
 */

export interface GeoField {
  name: string;
  lng: number;
  lat: number;
  installedMw: number;
  reservoirTempC: number;
  confidence: number;
  status: string;
}

export interface HighlandZone {
  name: string;
  description: string;
  primaryFields: string[];
  avgFavorability: number;
  coordinates: [number, number][][]; // polygon rings
}

export interface DEMMeta {
  width: number;
  height: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  minElev: number;
  maxElev: number;
}

export interface SuitabilityWeights {
  geothermal: number;  // favorability weight
  buildability: number;
  visibility: number;  // uniform 0.5 until viewshed raster available
}

const DEG_TO_KM_LAT = 111.32;
const DECAY_RADIUS_KM = 30;

/** Approximate distance in km between two lat/lng points */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_KM_LAT;
  const avgLat = (lat1 + lat2) / 2;
  const dLng = (lng2 - lng1) * DEG_TO_KM_LAT * Math.cos(avgLat * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Compute favorability at a point based on distance to nearest geothermal field.
 * favorability = max(0.1, 1.0 - distance / 30km)
 */
export function computeFavorability(lat: number, lng: number, fields: GeoField[]): number {
  let minDist = Infinity;
  for (const f of fields) {
    const d = distanceKm(lat, lng, f.lat, f.lng);
    if (d < minDist) minDist = d;
  }
  return Math.max(0.1, 1.0 - minDist / DECAY_RADIUS_KM);
}

/**
 * Compute buildability from slope.
 * slope < 10° → 1.0
 * slope 10°–30° → linear 1.0 to 0.0
 * slope > 30° → 0.0
 */
export function computeBuildability(slopeDeg: number): number {
  if (slopeDeg < 10) return 1.0;
  if (slopeDeg > 30) return 0.0;
  return 1.0 - (slopeDeg - 10) / 20;
}

/**
 * Compute slope in degrees from a 3x3 neighborhood of elevation values.
 * Uses Horn's method. Cells are in row-major order: [NW, N, NE, W, C, E, SW, S, SE]
 */
export function computeSlope(
  cells: [number, number, number, number, number, number, number, number, number],
  cellSizeM: number,
): number {
  const [nw, n, ne, w, , e, sw, s, se] = cells;
  const dzdx = ((ne + 2 * e + se) - (nw + 2 * w + sw)) / (8 * cellSizeM);
  const dzdy = ((sw + 2 * s + se) - (nw + 2 * n + ne)) / (8 * cellSizeM);
  const slopeRad = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
  return slopeRad * (180 / Math.PI);
}

/**
 * Composite suitability = weighted sum of favorability, buildability, visibility.
 * Visibility is uniform 0.5 until Phase D provides viewshed raster.
 */
export function compositeSuitability(
  favorability: number,
  buildability: number,
  weights: SuitabilityWeights,
): number {
  const visibility = 0.5; // uniform placeholder
  const totalWeight = weights.geothermal + weights.buildability + weights.visibility;
  if (totalWeight === 0) return 0;
  return (
    weights.geothermal * favorability +
    weights.buildability * buildability +
    weights.visibility * visibility
  ) / totalWeight;
}

/**
 * Convert lat/lng to pixel coordinates in the DEM image.
 */
export function lngLatToPixel(
  lng: number, lat: number, meta: DEMMeta
): { x: number; y: number } {
  const [minLng, minLat, maxLng, maxLat] = meta.bbox;
  const x = ((lng - minLng) / (maxLng - minLng)) * meta.width;
  const y = ((maxLat - lat) / (maxLat - minLat)) * meta.height;
  return { x, y };
}

/**
 * Convert pixel coordinates to lat/lng.
 */
export function pixelToLngLat(
  px: number, py: number, meta: DEMMeta
): { lng: number; lat: number } {
  const [minLng, minLat, maxLng, maxLat] = meta.bbox;
  const lng = minLng + (px / meta.width) * (maxLng - minLng);
  const lat = maxLat - (py / meta.height) * (maxLat - minLat);
  return { lng, lat };
}

/**
 * Compute area of a polygon in km² using shoelace formula with lat/lng.
 */
export function polygonAreaKm2(coords: [number, number][]): number {
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % n];
    area += lng1 * lat2 - lng2 * lat1;
  }
  area = Math.abs(area) / 2;
  // Convert from degree² to km²
  const avgLat = coords.reduce((s, c) => s + c[1], 0) / n;
  const kmPerDegLat = DEG_TO_KM_LAT;
  const kmPerDegLng = DEG_TO_KM_LAT * Math.cos(avgLat * Math.PI / 180);
  return area * kmPerDegLat * kmPerDegLng;
}

/** Estimate carrying capacity: ~5 MW per 10 km² at suitability 1.0 */
export function estimateCapacityMW(areaKm2: number, avgSuitability: number): number {
  return Math.round(areaKm2 * avgSuitability * 0.5);
}

/**
 * Phase C: Stack placement and clustering engine.
 *
 * Places stacks across a selected highland zone based on composite suitability,
 * forms clusters via single-linkage clustering, computes per-stack volumes
 * from position-specific site conditions.
 */

import { computeVolumes, type VolumeResultWithDeltas } from './simulationEngine';
import {
  computeFavorability,
  compositeSuitability,
  type GeoField,
  type HighlandZone,
  type SuitabilityWeights,
} from './suitabilityEngine';
import {
  singleLinkageClusters,
  computeMST,
  distKm,
} from '../utils/clustering';

// --- Types ---

export interface Stack {
  id: string;
  position: [number, number];  // [lng, lat]
  computeLoad: number;         // MW
  volumes: VolumeResultWithDeltas;
  siteScores: {
    favorability: number;
    buildability: number;
    visibility: number;
    composite: number;
  };
  clusterId: string | null;
  phase: number;               // 1–5 deployment priority
}

export interface Cluster {
  id: string;
  stackIds: string[];
  centroid: [number, number];
  totalCompute: number;
  mstEdges: [string, string][]; // pairs of stack IDs
  sharingFactor: number;        // 0.5–1.0
}

export interface PlacementResult {
  stacks: Stack[];
  clusters: Cluster[];
}

// --- Constants ---

const CLUSTER_THRESHOLD_KM = 3;
const CLUSTER_MAX_RADIUS_KM = 8;
const MIN_STACK_SPACING_KM = 0.5;   // 500m minimum between stacks
const MAX_MW_PER_STACK = 50;
const SAMPLE_SPACING_DEG = 0.003;    // ~250m grid spacing for suitability sampling

// --- Helpers ---

/** Check if a [lng, lat] point is inside a polygon ring (ray casting). */
function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Generate a grid of candidate positions within a polygon at ~250m spacing. */
function sampleGrid(zone: HighlandZone): [number, number][] {
  const ring = zone.coordinates[0];
  // Bounding box
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const points: [number, number][] = [];
  for (let lat = minLat; lat <= maxLat; lat += SAMPLE_SPACING_DEG) {
    for (let lng = minLng; lng <= maxLng; lng += SAMPLE_SPACING_DEG) {
      if (pointInRing(lng, lat, ring)) {
        points.push([lng, lat]);
      }
    }
  }
  return points;
}

/** Score all candidate positions and return sorted by composite suitability (descending). */
function scorePositions(
  candidates: [number, number][],
  fields: GeoField[],
  weights: SuitabilityWeights,
): { pos: [number, number]; favorability: number; buildability: number; visibility: number; composite: number }[] {
  const scored = candidates.map(pos => {
    const [lng, lat] = pos;
    const favorability = computeFavorability(lat, lng, fields);
    // Buildability: without per-pixel DEM slope in browser, use a heuristic
    // based on distance from edges and elevation variation (simplified)
    const buildability = 0.8; // Phase C simplification — full slope analysis requires DEM pixel access
    const visibility = 0.5;   // Uniform placeholder until viewshed raster
    const composite = compositeSuitability(favorability, buildability, weights);
    return { pos, favorability, buildability, visibility, composite };
  });
  scored.sort((a, b) => b.composite - a.composite);
  return scored;
}

// --- Main placement function ---

export function placeStacks(
  totalDemand: number,
  zone: HighlandZone,
  fields: GeoField[],
  weights: SuitabilityWeights,
  ambientTemp: number,
): PlacementResult {
  // 1. Generate candidate grid
  const candidates = sampleGrid(zone);
  if (candidates.length === 0) return { stacks: [], clusters: [] };

  // 2. Score all candidates
  const scored = scorePositions(candidates, fields, weights);

  // 3. Determine stack count
  const stackCount = Math.max(1, Math.ceil(totalDemand / MAX_MW_PER_STACK));

  // 4. Greedy placement: highest suitability first, ≥500m from all placed stacks
  const placed: typeof scored[number][] = [];
  for (const candidate of scored) {
    if (placed.length >= stackCount) break;
    const tooClose = placed.some(p => distKm(p.pos, candidate.pos) < MIN_STACK_SPACING_KM);
    if (!tooClose) {
      placed.push(candidate);
    }
  }

  // If we couldn't place enough stacks (zone too small), place what we can
  if (placed.length === 0) return { stacks: [], clusters: [] };

  // Redistribute load among actually placed stacks
  const actualLoad = totalDemand / placed.length;

  // 5. Build raw stacks (without cluster info yet)
  const rawStacks: Stack[] = placed.map((p, i) => ({
    id: `stack-${i}`,
    position: p.pos,
    computeLoad: actualLoad,
    volumes: computeVolumes({
      computeLoad: actualLoad,
      favorability: p.favorability,
      ambientTemp,
    }),
    siteScores: {
      favorability: p.favorability,
      buildability: p.buildability,
      visibility: p.visibility,
      composite: p.composite,
    },
    clusterId: null,
    phase: 1,
  }));

  // 6. Assign phases 1–5 by suitability score rank
  const sortedByScore = [...rawStacks].sort((a, b) => b.siteScores.composite - a.siteScores.composite);
  const phaseSize = Math.ceil(sortedByScore.length / 5);
  sortedByScore.forEach((stack, i) => {
    stack.phase = Math.min(5, Math.floor(i / phaseSize) + 1);
  });

  // 7. Cluster stacks
  const positions = rawStacks.map(s => s.position);
  const groups = singleLinkageClusters(positions, CLUSTER_THRESHOLD_KM, CLUSTER_MAX_RADIUS_KM);

  const clusters: Cluster[] = groups.map((memberIndices, ci) => {
    const clusterId = `cluster-${ci}`;
    const stackIds = memberIndices.map(i => rawStacks[i].id);
    const memberPositions = memberIndices.map(i => rawStacks[i].position);

    // Assign cluster ID to stacks
    for (const idx of memberIndices) {
      rawStacks[idx].clusterId = clusterId;
    }

    // Centroid
    const cx = memberPositions.reduce((s, p) => s + p[0], 0) / memberPositions.length;
    const cy = memberPositions.reduce((s, p) => s + p[1], 0) / memberPositions.length;

    // Total compute
    const totalCompute = memberIndices.reduce((s, i) => s + rawStacks[i].computeLoad, 0);

    // Sharing factor: denser clusters share more infrastructure
    // 1.0 = isolated (1 stack), 0.5 = very dense cluster
    const maxMembers = 10;
    const sharingFactor = Math.max(0.5, 1.0 - 0.5 * (memberIndices.length - 1) / maxMembers);

    // MST within cluster
    const mstIndices = computeMST(memberPositions);
    const mstEdges: [string, string][] = mstIndices.map(([a, b]) => [
      rawStacks[memberIndices[a]].id,
      rawStacks[memberIndices[b]].id,
    ]);

    return {
      id: clusterId,
      stackIds,
      centroid: [cx, cy] as [number, number],
      totalCompute,
      mstEdges,
      sharingFactor,
    };
  });

  // 8. Recompute volumes with sharing factor from cluster
  for (const cluster of clusters) {
    for (const stackId of cluster.stackIds) {
      const stack = rawStacks.find(s => s.id === stackId);
      if (!stack) continue;

      // Find nearest neighbor distance within cluster
      let nearestDist = 0;
      for (const otherId of cluster.stackIds) {
        if (otherId === stackId) continue;
        const other = rawStacks.find(s => s.id === otherId);
        if (!other) continue;
        const d = distKm(stack.position, other.position);
        if (nearestDist === 0 || d < nearestDist) nearestDist = d;
      }

      stack.volumes = computeVolumes({
        computeLoad: stack.computeLoad,
        favorability: stack.siteScores.favorability,
        ambientTemp,
        interStackDistance: nearestDist * 1000 * 3.281, // km → ft
        sharingFactor: cluster.sharingFactor,
      });
    }
  }

  return { stacks: rawStacks, clusters };
}

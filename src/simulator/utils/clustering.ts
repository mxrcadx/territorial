/**
 * Phase C: Clustering utilities.
 * Single-linkage clustering, minimum spanning tree, convex hull.
 */

const DEG_TO_KM_LAT = 111.32;

/** Approximate distance in km between two [lng, lat] points */
export function distKm(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * DEG_TO_KM_LAT;
  const avgLat = (a[1] + b[1]) / 2;
  const dLng = (b[0] - a[0]) * DEG_TO_KM_LAT * Math.cos(avgLat * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Single-linkage clustering.
 * Groups points where any member is within `thresholdKm` of another member.
 * Enforces maxRadiusKm: if adding a point would push cluster radius beyond max, skip it.
 */
export function singleLinkageClusters(
  positions: [number, number][],
  thresholdKm: number,
  maxRadiusKm: number,
): number[][] {
  const n = positions.length;
  // Union-Find
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number) { parent[find(a)] = find(b); }

  // Build edges sorted by distance
  const edges: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distKm(positions[i], positions[j]);
      if (d <= thresholdKm) edges.push({ i, j, d });
    }
  }
  edges.sort((a, b) => a.d - b.d);

  // Merge clusters, checking max radius
  for (const { i, j } of edges) {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) continue;

    // Collect members of both groups
    const members: number[] = [];
    for (let k = 0; k < n; k++) {
      if (find(k) === ri || find(k) === rj) members.push(k);
    }

    // Check max radius (max distance from centroid)
    const cx = members.reduce((s, m) => s + positions[m][0], 0) / members.length;
    const cy = members.reduce((s, m) => s + positions[m][1], 0) / members.length;
    const centroid: [number, number] = [cx, cy];
    const maxDist = Math.max(...members.map(m => distKm(positions[m], centroid)));
    if (maxDist <= maxRadiusKm) {
      union(i, j);
    }
  }

  // Collect groups
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }
  return Array.from(groups.values());
}

/**
 * Minimum spanning tree using Prim's algorithm.
 * Returns edge pairs as indices into the input positions array.
 */
export function computeMST(positions: [number, number][]): [number, number][] {
  const n = positions.length;
  if (n < 2) return [];

  const inTree = new Set<number>([0]);
  const edges: [number, number][] = [];

  while (inTree.size < n) {
    let bestDist = Infinity;
    let bestFrom = -1;
    let bestTo = -1;

    for (const from of inTree) {
      for (let to = 0; to < n; to++) {
        if (inTree.has(to)) continue;
        const d = distKm(positions[from], positions[to]);
        if (d < bestDist) {
          bestDist = d;
          bestFrom = from;
          bestTo = to;
        }
      }
    }

    if (bestTo === -1) break;
    inTree.add(bestTo);
    edges.push([bestFrom, bestTo]);
  }

  return edges;
}

/**
 * Convex hull using Graham scan. Returns ordered vertices.
 */
export function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return [...points];

  // Find bottom-most (then left-most) point
  const sorted = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const pivot = sorted[0];

  // Sort by polar angle from pivot
  sorted.sort((a, b) => {
    if (a === pivot) return -1;
    if (b === pivot) return 1;
    const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    return angleA - angleB;
  });

  const stack: [number, number][] = [];
  for (const pt of sorted) {
    while (stack.length >= 2) {
      const a = stack[stack.length - 2];
      const b = stack[stack.length - 1];
      const cross = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
      if (cross <= 0) stack.pop();
      else break;
    }
    stack.push(pt);
  }

  return stack;
}

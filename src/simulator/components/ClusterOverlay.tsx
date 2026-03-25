/**
 * Phase C: Draw cluster overlays on the map canvas.
 * Convex hull boundaries, MST edges within clusters, inter-cluster network.
 */

import { convexHull } from '../utils/clustering';
import type { Stack, Cluster } from '../engine/placementEngine';

type ProjectFn = (lng: number, lat: number) => { x: number; y: number };

/** Draw convex hull boundaries and MST edges for each cluster. */
export function drawClusters(
  ctx: CanvasRenderingContext2D,
  clusters: Cluster[],
  stacks: Stack[],
  project: ProjectFn,
  visiblePhase: number,
) {
  const stackMap = new Map(stacks.map(s => [s.id, s]));

  for (const cluster of clusters) {
    // Filter to visible stacks in this cluster
    const visibleIds = cluster.stackIds.filter(id => {
      const s = stackMap.get(id);
      return s && s.phase <= visiblePhase;
    });
    if (visibleIds.length < 1) continue;

    const positions = visibleIds.map(id => stackMap.get(id)!.position);

    // Convex hull boundary (only draw if ≥3 stacks visible)
    if (positions.length >= 3) {
      const hull = convexHull(positions);
      const hullPts = hull.map(p => project(p[0], p[1]));

      ctx.beginPath();
      ctx.moveTo(hullPts[0].x, hullPts[0].y);
      for (let i = 1; i < hullPts.length; i++) {
        ctx.lineTo(hullPts[i].x, hullPts[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Faint fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
    }

    // MST edges
    for (const [idA, idB] of cluster.mstEdges) {
      const a = stackMap.get(idA);
      const b = stackMap.get(idB);
      if (!a || !b) continue;
      if (a.phase > visiblePhase || b.phase > visiblePhase) continue;

      const ptA = project(a.position[0], a.position[1]);
      const ptB = project(b.position[0], b.position[1]);

      ctx.beginPath();
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/** Draw inter-cluster network (ring or star topology). */
export function drawInterClusterNetwork(
  ctx: CanvasRenderingContext2D,
  clusters: Cluster[],
  project: ProjectFn,
  topology: 'ring' | 'star',
  visiblePhase: number,
  stacks: Stack[],
) {
  // Only show clusters that have at least one visible stack
  const stackMap = new Map(stacks.map(s => [s.id, s]));
  const activeClusters = clusters.filter(c =>
    c.stackIds.some(id => {
      const s = stackMap.get(id);
      return s && s.phase <= visiblePhase;
    })
  );

  if (activeClusters.length < 2) return;

  const centroids = activeClusters.map(c => project(c.centroid[0], c.centroid[1]));

  ctx.strokeStyle = 'rgba(217, 64, 64, 0.4)'; // red, semi-transparent
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  if (topology === 'ring') {
    // Connect centroids in a ring
    ctx.beginPath();
    ctx.moveTo(centroids[0].x, centroids[0].y);
    for (let i = 1; i < centroids.length; i++) {
      ctx.lineTo(centroids[i].x, centroids[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    // Star: connect all to centroid of centroids
    const cx = centroids.reduce((s, p) => s + p.x, 0) / centroids.length;
    const cy = centroids.reduce((s, p) => s + p.y, 0) / centroids.length;

    for (const pt of centroids) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    // Draw hub marker
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217, 64, 64, 0.6)';
    ctx.fill();
  }

  ctx.setLineDash([]);

  // Draw cluster centroid dots
  for (const pt of centroids) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217, 64, 64, 0.5)';
    ctx.fill();
  }
}

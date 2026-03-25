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
    const visibleIds = cluster.stackIds.filter(id => {
      const s = stackMap.get(id);
      return s && s.phase <= visiblePhase;
    });
    if (visibleIds.length < 1) continue;

    const positions = visibleIds.map(id => stackMap.get(id)!.position);

    // Convex hull boundary — draw for ≥2 stacks (line for 2, polygon for 3+)
    if (positions.length >= 2) {
      const hull = positions.length >= 3 ? convexHull(positions) : positions;
      const hullPts = hull.map(p => project(p[0], p[1]));

      ctx.beginPath();
      ctx.moveTo(hullPts[0].x, hullPts[0].y);
      for (let i = 1; i < hullPts.length; i++) {
        ctx.lineTo(hullPts[i].x, hullPts[i].y);
      }
      if (positions.length >= 3) ctx.closePath();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Faint fill for polygons
      if (positions.length >= 3) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fill();
      }
    }

    // MST edges — thin white lines connecting stacks
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
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
  const stackMap = new Map(stacks.map(s => [s.id, s]));
  const activeClusters = clusters.filter(c =>
    c.stackIds.some(id => {
      const s = stackMap.get(id);
      return s && s.phase <= visiblePhase;
    })
  );

  if (activeClusters.length < 2) return;

  const centroids = activeClusters.map(c => project(c.centroid[0], c.centroid[1]));

  ctx.strokeStyle = 'rgba(217, 64, 64, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  if (topology === 'ring') {
    ctx.beginPath();
    ctx.moveTo(centroids[0].x, centroids[0].y);
    for (let i = 1; i < centroids.length; i++) {
      ctx.lineTo(centroids[i].x, centroids[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    const cx = centroids.reduce((s, p) => s + p.x, 0) / centroids.length;
    const cy = centroids.reduce((s, p) => s + p.y, 0) / centroids.length;

    for (const pt of centroids) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    // Hub marker
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217, 64, 64, 0.6)';
    ctx.fill();
  }

  ctx.setLineDash([]);

  // Cluster centroid dots
  for (const pt of centroids) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217, 64, 64, 0.5)';
    ctx.fill();
  }
}

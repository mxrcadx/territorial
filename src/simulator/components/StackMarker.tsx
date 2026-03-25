/**
 * Phase C: Draw stack markers on the map canvas.
 * Each marker is a miniature stacked bar chart showing the five volume types.
 * Visually distinct from geothermal field circles.
 */

import { VOLUME_COLORS, SECTION_ORDER, type VolumeType } from '../engine/constants';
import type { Stack } from '../engine/placementEngine';

const MARKER_WIDTH = 16;
const MIN_MARKER_HEIGHT = 20;
const MAX_MARKER_HEIGHT = 55;

export function drawStackMarkers(
  ctx: CanvasRenderingContext2D,
  stacks: Stack[],
  project: (lng: number, lat: number) => { x: number; y: number },
  visiblePhase: number,
  selectedStackId: string | null,
  hoveredStackId: string | null,
) {
  const visible = stacks.filter(s => s.phase <= visiblePhase);
  if (visible.length === 0) return;

  // Find max total volume for scaling
  const maxVol = Math.max(...visible.map(s =>
    SECTION_ORDER.reduce((sum, k) => sum + s.volumes[k], 0)
  ));

  for (const stack of visible) {
    const pt = project(stack.position[0], stack.position[1]);
    const totalVol = SECTION_ORDER.reduce((sum, k) => sum + stack.volumes[k], 0);
    const barHeight = MIN_MARKER_HEIGHT + (totalVol / maxVol) * (MAX_MARKER_HEIGHT - MIN_MARKER_HEIGHT);

    const isSelected = stack.id === selectedStackId;
    const isHovered = stack.id === hoveredStackId;
    const w = isSelected ? MARKER_WIDTH + 4 : isHovered ? MARKER_WIDTH + 2 : MARKER_WIDTH;

    // Dark background behind bar for contrast
    ctx.fillStyle = '#0A0A0A';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(pt.x - w / 2 - 1, pt.y - barHeight - 1, w + 2, barHeight + 2);
    ctx.globalAlpha = 1.0;

    // Draw stacked bar (bottom-to-top)
    let y = pt.y;
    for (const key of SECTION_ORDER) {
      const vol = stack.volumes[key as VolumeType];
      const segHeight = Math.max(1, (vol / totalVol) * barHeight);
      ctx.fillStyle = VOLUME_COLORS[key as VolumeType];
      ctx.globalAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.85;
      ctx.fillRect(pt.x - w / 2, y - segHeight, w, segHeight);
      y -= segHeight;
    }
    ctx.globalAlpha = 1.0;

    // Outline — always draw a thin border for definition
    ctx.strokeStyle = isSelected ? '#fff' : isHovered ? '#ddd' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(pt.x - w / 2, pt.y - barHeight, w, barHeight);

    // Small base tick (ground marker)
    ctx.fillStyle = '#888';
    ctx.fillRect(pt.x - 2, pt.y, 4, 2);
  }
}

/** Hit-test: find stack near screen coordinates. Returns stack id or null. */
export function hitTestStack(
  sx: number,
  sy: number,
  stacks: Stack[],
  project: (lng: number, lat: number) => { x: number; y: number },
  visiblePhase: number,
): string | null {
  const HIT_RADIUS = 20;
  let closest: string | null = null;
  let closestDist = HIT_RADIUS;

  for (const stack of stacks) {
    if (stack.phase > visiblePhase) continue;
    const pt = project(stack.position[0], stack.position[1]);
    // Hit test against the bar area, not just center
    const dx = Math.abs(sx - pt.x);
    const dy = sy - (pt.y - MAX_MARKER_HEIGHT / 2); // vertical center of bar
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < closestDist) {
      closestDist = d;
      closest = stack.id;
    }
  }
  return closest;
}

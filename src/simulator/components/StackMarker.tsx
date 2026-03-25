/**
 * Phase C: Draw stack markers on the map canvas.
 * Each marker is a miniature stacked bar chart showing the five volume types.
 */

import { VOLUME_COLORS, SECTION_ORDER, type VolumeType } from '../engine/constants';
import type { Stack } from '../engine/placementEngine';

const MARKER_WIDTH = 8;
const MAX_MARKER_HEIGHT = 40;

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
    const barHeight = Math.max(8, (totalVol / maxVol) * MAX_MARKER_HEIGHT);

    const isSelected = stack.id === selectedStackId;
    const isHovered = stack.id === hoveredStackId;

    // Draw stacked bar (bottom-to-top)
    let y = pt.y;
    for (const key of SECTION_ORDER) {
      const vol = stack.volumes[key as VolumeType];
      const segHeight = (vol / totalVol) * barHeight;
      ctx.fillStyle = VOLUME_COLORS[key as VolumeType];
      ctx.globalAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.8;
      ctx.fillRect(pt.x - MARKER_WIDTH / 2, y - segHeight, MARKER_WIDTH, segHeight);
      y -= segHeight;
    }

    // Outline
    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? '#fff' : '#ccc';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.globalAlpha = 1.0;
      ctx.strokeRect(pt.x - MARKER_WIDTH / 2 - 1, pt.y - barHeight - 1, MARKER_WIDTH + 2, barHeight + 2);
    }

    ctx.globalAlpha = 1.0;
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
  const HIT_RADIUS = 12;
  let closest: string | null = null;
  let closestDist = HIT_RADIUS;

  for (const stack of stacks) {
    if (stack.phase > visiblePhase) continue;
    const pt = project(stack.position[0], stack.position[1]);
    const d = Math.sqrt((sx - pt.x) ** 2 + (sy - pt.y) ** 2);
    if (d < closestDist) {
      closestDist = d;
      closest = stack.id;
    }
  }
  return closest;
}

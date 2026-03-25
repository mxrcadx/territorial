import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store';
import {
  computeFavorability,
  lngLatToPixel,
  pixelToLngLat,
  polygonAreaKm2,
  estimateCapacityMW,
  type GeoField,
  type HighlandZone,
} from '../engine/suitabilityEngine';

/**
 * Favorability color ramp: yellow (high) → dark purple (low), semi-transparent.
 */
function favorabilityColor(fav: number): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, fav));
  // Yellow (1.0) → Orange (0.6) → Purple (0.1)
  const r = Math.round(80 + 175 * t);
  const g = Math.round(20 + 200 * t * t);
  const b = Math.round(120 * (1 - t) + 30 * t);
  return [r, g, b, Math.round(100 + 50 * t)];
}

export function MapView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    geoFields, highlandZones, demMeta,
    selectedZoneIndex, hoveredFieldIndex, hoveredZoneIndex,
    setSelectedZone, setHoveredField, setHoveredZone,
    setGeoFields, setHighlandZones, setDEMMeta,
    showFavorability,
  } = useStore();

  const [heightmapImg, setHeightmapImg] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; sub?: string } | null>(null);
  const [favCache, setFavCache] = useState<ImageData | null>(null);

  // Load data on mount
  useEffect(() => {
    // Load heightmap PNG
    const img = new Image();
    img.onload = () => setHeightmapImg(img);
    img.src = '/data/iceland_heightmap.png';

    // Load DEM metadata
    fetch('/data/iceland_dem_meta.json')
      .then(r => r.json())
      .then(m => setDEMMeta(m));

    // Load geothermal fields
    fetch('/data/geothermal_fields.geojson')
      .then(r => r.json())
      .then(geojson => {
        const fields: GeoField[] = geojson.features.map((f: Record<string, unknown>) => {
          const p = f.properties as Record<string, unknown>;
          const g = f.geometry as { coordinates: [number, number] };
          return {
            name: p.name as string,
            lng: g.coordinates[0],
            lat: g.coordinates[1],
            installedMw: (p.installed_mw ?? 0) as number,
            reservoirTempC: (p.reservoir_temp_c ?? 0) as number,
            confidence: (p.confidence ?? 0) as number,
            status: (p.status ?? '') as string,
          };
        });
        setGeoFields(fields);
      });

    // Load highland zones
    fetch('/data/highland_zones.geojson')
      .then(r => r.json())
      .then(geojson => {
        const zones: HighlandZone[] = geojson.features.map((f: Record<string, unknown>) => {
          const p = f.properties as Record<string, unknown>;
          const g = f.geometry as { coordinates: [number, number][][] };
          return {
            name: p.name as string,
            description: (p.description ?? '') as string,
            primaryFields: (p.primary_fields ?? []) as string[],
            avgFavorability: (p.avg_favorability ?? 0) as number,
            coordinates: g.coordinates,
          };
        });
        setHighlandZones(zones);
      });
  }, [setDEMMeta, setGeoFields, setHighlandZones]);

  // Resize canvas to container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Projection helpers
  const project = useCallback((lng: number, lat: number) => {
    if (!demMeta) return { x: 0, y: 0 };
    const px = lngLatToPixel(lng, lat, demMeta);
    const scaleX = canvasSize.w / demMeta.width;
    const scaleY = canvasSize.h / demMeta.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.w - demMeta.width * scale) / 2;
    const offsetY = (canvasSize.h - demMeta.height * scale) / 2;
    return {
      x: px.x * scale + offsetX,
      y: px.y * scale + offsetY,
    };
  }, [demMeta, canvasSize]);

  const unproject = useCallback((sx: number, sy: number) => {
    if (!demMeta) return { lng: 0, lat: 0 };
    const scaleX = canvasSize.w / demMeta.width;
    const scaleY = canvasSize.h / demMeta.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.w - demMeta.width * scale) / 2;
    const offsetY = (canvasSize.h - demMeta.height * scale) / 2;
    const px = (sx - offsetX) / scale;
    const py = (sy - offsetY) / scale;
    return pixelToLngLat(px, py, demMeta);
  }, [demMeta, canvasSize]);

  // Compute favorability heatmap cache
  useEffect(() => {
    if (!demMeta || geoFields.length === 0 || canvasSize.w < 10) return;

    const RES = 4; // compute every 4th pixel for performance
    const w = Math.ceil(canvasSize.w / RES);
    const h = Math.ceil(canvasSize.h / RES);
    const imgData = new ImageData(w, h);

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const { lng, lat } = unproject(px * RES, py * RES);
        // Skip if outside Iceland bounds
        if (lng < demMeta.bbox[0] || lng > demMeta.bbox[2] ||
            lat < demMeta.bbox[1] || lat > demMeta.bbox[3]) {
          continue;
        }
        const fav = computeFavorability(lat, lng, geoFields);
        const [r, g, b, a] = favorabilityColor(fav);
        const idx = (py * w + px) * 4;
        imgData.data[idx] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = a;
      }
    }
    setFavCache(imgData);
  }, [demMeta, geoFields, canvasSize, unproject]);

  // Draw heightmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heightmapImg || !demMeta) return;

    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // Fit image to canvas maintaining aspect ratio
    const scaleX = canvasSize.w / demMeta.width;
    const scaleY = canvasSize.h / demMeta.height;
    const scale = Math.min(scaleX, scaleY);
    const drawW = demMeta.width * scale;
    const drawH = demMeta.height * scale;
    const offsetX = (canvasSize.w - drawW) / 2;
    const offsetY = (canvasSize.h - drawH) / 2;

    // Darken the heightmap for better contrast with overlays
    ctx.globalAlpha = 0.6;
    ctx.drawImage(heightmapImg, offsetX, offsetY, drawW, drawH);
    ctx.globalAlpha = 1.0;
  }, [heightmapImg, demMeta, canvasSize]);

  // Draw overlays
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !demMeta) return;

    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // Favorability heatmap
    if (showFavorability && favCache) {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = favCache.width;
      tmpCanvas.height = favCache.height;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.putImageData(favCache, 0, 0);
      ctx.globalAlpha = 0.4;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmpCanvas, 0, 0, canvasSize.w, canvasSize.h);
      ctx.globalAlpha = 1.0;
    }

    // Selected zone dimming — draw a mask over everything except selected zone
    if (selectedZoneIndex !== null && highlandZones[selectedZoneIndex]) {
      const zone = highlandZones[selectedZoneIndex];
      ctx.save();
      // Dim everything
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
      // Clear the selected zone area
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      const ring = zone.coordinates[0];
      const start = project(ring[0][0], ring[0][1]);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < ring.length; i++) {
        const pt = project(ring[i][0], ring[i][1]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Highland zone boundaries
    highlandZones.forEach((zone, i) => {
      const ring = zone.coordinates[0];
      ctx.beginPath();
      const start = project(ring[0][0], ring[0][1]);
      ctx.moveTo(start.x, start.y);
      for (let j = 1; j < ring.length; j++) {
        const pt = project(ring[j][0], ring[j][1]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      const isSelected = selectedZoneIndex === i;
      const isHovered = hoveredZoneIndex === i;

      ctx.strokeStyle = isSelected ? '#fff' : isHovered ? '#aaa' : '#555';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.setLineDash(isSelected ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      }
    });

    // Geothermal field markers
    geoFields.forEach((field, i) => {
      const pt = project(field.lng, field.lat);
      const radius = Math.max(4, Math.sqrt(field.installedMw) * 0.8 + 3);
      const isHovered = hoveredFieldIndex === i;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#4ade80' : '#2D7A3A';
      ctx.globalAlpha = isHovered ? 1.0 : 0.85;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Always show name for active production fields
      if (field.installedMw > 0 || isHovered) {
        ctx.font = `${isHovered ? 11 : 9}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = isHovered ? '#fff' : '#aaa';
        ctx.textAlign = 'left';
        ctx.fillText(field.name, pt.x + radius + 4, pt.y + 3);
      }
    });
  }, [
    demMeta, geoFields, highlandZones, canvasSize,
    selectedZoneIndex, hoveredFieldIndex, hoveredZoneIndex,
    showFavorability, favCache, project,
  ]);

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Check fields (closest within threshold)
    let hitField = -1;
    let minDist = 20;
    geoFields.forEach((f, i) => {
      const pt = project(f.lng, f.lat);
      const d = Math.sqrt((sx - pt.x) ** 2 + (sy - pt.y) ** 2);
      if (d < minDist) { minDist = d; hitField = i; }
    });

    if (hitField >= 0) {
      const f = geoFields[hitField];
      setHoveredField(hitField);
      setHoveredZone(null);
      setTooltip({
        x: sx, y: sy,
        text: f.name,
        sub: f.installedMw > 0
          ? `${f.installedMw} MW installed — ${f.reservoirTempC}°C`
          : `${f.reservoirTempC}°C — ${f.status}`,
      });
      return;
    }
    setHoveredField(null);

    // Check zones
    let hitZone = -1;
    highlandZones.forEach((zone, i) => {
      const ring = zone.coordinates[0];
      const pts = ring.map(c => project(c[0], c[1]));
      if (pointInPolygon(sx, sy, pts)) hitZone = i;
    });

    if (hitZone >= 0) {
      const z = highlandZones[hitZone];
      setHoveredZone(hitZone);
      setTooltip({
        x: sx, y: sy,
        text: z.name,
        sub: z.description,
      });
    } else {
      setHoveredZone(null);
      setTooltip(null);
    }
  }, [geoFields, highlandZones, project, setHoveredField, setHoveredZone]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Check zones
    for (let i = 0; i < highlandZones.length; i++) {
      const ring = highlandZones[i].coordinates[0];
      const pts = ring.map(c => project(c[0], c[1]));
      if (pointInPolygon(sx, sy, pts)) {
        setSelectedZone(selectedZoneIndex === i ? null : i);
        return;
      }
    }
    setSelectedZone(null);
  }, [highlandZones, project, selectedZoneIndex, setSelectedZone]);

  const handleMouseLeave = useCallback(() => {
    setHoveredField(null);
    setHoveredZone(null);
    setTooltip(null);
  }, [setHoveredField, setHoveredZone]);

  // Zone stats
  const selectedZone = selectedZoneIndex !== null ? highlandZones[selectedZoneIndex] : null;
  const zoneStats = selectedZone ? (() => {
    const ring = selectedZone.coordinates[0];
    const area = polygonAreaKm2(ring);
    const avgSuit = selectedZone.avgFavorability;
    const capacity = estimateCapacityMW(area, avgSuit);
    return { area, avgSuit, capacity };
  })() : null;

  return (
    <div ref={containerRef} className="flex-1 relative bg-[#0A0A0A] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[#1a1a1a] border border-neutral-700 rounded px-3 py-2 max-w-[260px]"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 10,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div className="text-[11px] text-white">{tooltip.text}</div>
          {tooltip.sub && (
            <div className="text-[9px] text-neutral-400 mt-0.5 leading-tight">{tooltip.sub}</div>
          )}
        </div>
      )}

      {/* Zone stats panel */}
      {selectedZone && zoneStats && (
        <div className="absolute bottom-4 right-4 bg-[#111111] border border-neutral-700 rounded px-4 py-3 max-w-[280px]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <div className="text-[11px] text-white font-semibold uppercase tracking-wider mb-2">
            {selectedZone.name}
          </div>
          <div className="text-[9px] text-neutral-400 mb-3 leading-tight">
            {selectedZone.description}
          </div>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-neutral-500">Area</span>
              <span className="text-white tabular-nums">{zoneStats.area.toFixed(0)} km²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Avg Suitability</span>
              <span className="text-white tabular-nums">{zoneStats.avgSuit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Est. Capacity</span>
              <span className="text-white tabular-nums">{zoneStats.capacity} MW</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Point-in-polygon test (ray casting) */
function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

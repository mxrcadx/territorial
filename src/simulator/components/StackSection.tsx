import { useState } from 'react';
import { useStore } from '../store';
import { VOLUME_COLORS, SECTION_ORDER, VOLUME_TOOLTIPS, REF, type VolumeType } from '../engine/constants';

const VOLUME_LABELS: Record<VolumeType, string> = {
  compute: 'Compute',
  geothermal: 'Geothermal',
  cooling: 'Cooling',
  support: 'Support',
  circulation: 'Circulation',
};

const SVG_WIDTH = 600;
const SVG_HEIGHT = 780;
const SECTION_WIDTH = 260;
const SECTION_X = (SVG_WIDTH - SECTION_WIDTH) / 2;
const GROUND_Y = SVG_HEIGHT - 120;
const GAP = 2;
const WELL_DEPTH = 50;

const MAX_SECTION_HEIGHT = 520;
const MAX_MW = 50;
const MIN_MW = 5;

export function StackSection() {
  const volumes = useStore((s) => s.volumes);
  const computeLoad = useStore((s) => s.computeLoad);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const totalVolume = SECTION_ORDER.reduce((sum, key) => sum + volumes[key], 0);
  if (totalVolume === 0) return null;

  const loadFraction = (computeLoad - MIN_MW) / (MAX_MW - MIN_MW);
  const scaledHeight = MAX_SECTION_HEIGHT * (0.25 + 0.75 * loadFraction);
  const availableHeight = scaledHeight - (SECTION_ORDER.length - 1) * GAP;

  let currentY = GROUND_Y;
  const blocks = SECTION_ORDER.map((key) => {
    const vol = volumes[key];
    const height = Math.max(4, (vol / totalVolume) * availableHeight);
    const y = currentY - height;
    currentY = y - GAP;
    const delta = volumes.deltas[key];
    const deltaStr = delta >= 10 ? delta.toFixed(0) + '×' : delta.toFixed(1) + '×';
    return { key, vol, height, y, delta, deltaStr };
  });

  const pxPerFt = volumes.totalHeight > 0 ? scaledHeight / volumes.totalHeight : 1;
  const humanHeightPx = 6 * pxPerFt;
  const humanX = SECTION_X - 24;

  const wellCount = volumes.wellCount;
  const wellSpacing = SECTION_WIDTH / (wellCount + 1);

  function handleMouseSvg(e: React.MouseEvent<SVGGElement>, key: string) {
    setHoveredKey(key);
    const svg = e.currentTarget.ownerSVGElement;
    if (svg) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      setTooltipPos({ x: svgPt.x, y: svgPt.y });
    }
  }

  const topBlock = blocks[blocks.length - 1];
  const dimLineX = SECTION_X + SECTION_WIDTH + 30;

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0A0A0A] relative">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-full max-w-[600px] max-h-[780px]"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
        onMouseLeave={() => setHoveredKey(null)}
      >
        {/* Title */}
        <text x={SVG_WIDTH / 2} y={28} fill="#666" fontSize={11} textAnchor="middle" letterSpacing={2}>
          STACK SECTION
        </text>

        {/* Volume blocks */}
        {blocks.map(({ key, vol, height, y, deltaStr }) => (
          <g
            key={key}
            onMouseEnter={(e) => handleMouseSvg(e, key)}
            onMouseMove={(e) => handleMouseSvg(e, key)}
            onMouseLeave={() => setHoveredKey(null)}
            className="cursor-default"
          >
            <rect
              x={SECTION_X} y={y} width={SECTION_WIDTH} height={height}
              fill={VOLUME_COLORS[key as VolumeType]}
              opacity={hoveredKey === key ? 0.95 : 0.85}
            />
            <rect
              x={SECTION_X} y={y} width={SECTION_WIDTH} height={height}
              fill="none" stroke="#000" strokeWidth={0.8}
            />
            {height > 20 && (
              <>
                <text x={SECTION_X + 8} y={y + height / 2 - 2} fill="#fff" fontSize={10} dominantBaseline="middle" opacity={0.9}>
                  {VOLUME_LABELS[key as VolumeType]}
                </text>
                <text x={SECTION_X + 8} y={y + height / 2 + 12} fill="#fff" fontSize={9} dominantBaseline="middle" opacity={0.55}>
                  {vol.toFixed(0)} ft³
                </text>
                <text x={SECTION_X + SECTION_WIDTH - 8} y={y + height / 2 + 4} fill="#fff" fontSize={9} textAnchor="end" dominantBaseline="middle" opacity={0.4}>
                  {deltaStr}
                </text>
              </>
            )}
          </g>
        ))}

        {/* Ground line */}
        <line x1={SECTION_X} y1={GROUND_Y} x2={SECTION_X + SECTION_WIDTH} y2={GROUND_Y} stroke="#888" strokeWidth={2} />

        {/* Wells */}
        {Array.from({ length: wellCount }, (_, i) => {
          const wx = SECTION_X + wellSpacing * (i + 1);
          return <line key={i} x1={wx} y1={GROUND_Y + 2} x2={wx} y2={GROUND_Y + WELL_DEPTH} stroke="#555" strokeWidth={1} strokeDasharray="3 3" />;
        })}
        <text x={SVG_WIDTH / 2} y={GROUND_Y + WELL_DEPTH + 16} fill="#555" fontSize={10} textAnchor="middle">
          {wellCount} wells
        </text>

        {/* Human figure — 6 ft stick figure, clearly visible for scale */}
        {humanHeightPx > 1.5 && (
          <g opacity={0.7}>
            <circle cx={humanX} cy={GROUND_Y - humanHeightPx + humanHeightPx * 0.08} r={Math.max(humanHeightPx * 0.08, 2)} fill="none" stroke="#fff" strokeWidth={2} />
            <line x1={humanX} y1={GROUND_Y - humanHeightPx + humanHeightPx * 0.16} x2={humanX} y2={GROUND_Y - humanHeightPx * 0.4} stroke="#fff" strokeWidth={2} />
            <line x1={humanX - humanHeightPx * 0.15} y1={GROUND_Y - humanHeightPx * 0.6} x2={humanX + humanHeightPx * 0.15} y2={GROUND_Y - humanHeightPx * 0.6} stroke="#fff" strokeWidth={2} />
            <line x1={humanX} y1={GROUND_Y - humanHeightPx * 0.4} x2={humanX - humanHeightPx * 0.12} y2={GROUND_Y} stroke="#fff" strokeWidth={2} />
            <line x1={humanX} y1={GROUND_Y - humanHeightPx * 0.4} x2={humanX + humanHeightPx * 0.12} y2={GROUND_Y} stroke="#fff" strokeWidth={2} />
            <text x={humanX} y={GROUND_Y + 14} fill="#aaa" fontSize={9} textAnchor="middle">6 ft</text>
          </g>
        )}

        {/* Width dimension */}
        <g>
          <line x1={SECTION_X} y1={GROUND_Y + WELL_DEPTH + 30} x2={SECTION_X + SECTION_WIDTH} y2={GROUND_Y + WELL_DEPTH + 30} stroke="#444" strokeWidth={0.5} />
          <line x1={SECTION_X} y1={GROUND_Y + WELL_DEPTH + 26} x2={SECTION_X} y2={GROUND_Y + WELL_DEPTH + 34} stroke="#444" strokeWidth={0.5} />
          <line x1={SECTION_X + SECTION_WIDTH} y1={GROUND_Y + WELL_DEPTH + 26} x2={SECTION_X + SECTION_WIDTH} y2={GROUND_Y + WELL_DEPTH + 34} stroke="#444" strokeWidth={0.5} />
          <text x={SVG_WIDTH / 2} y={GROUND_Y + WELL_DEPTH + 44} fill="#555" fontSize={10} textAnchor="middle">
            {REF.STACK_WIDTH.toFixed(0)} ft
          </text>
        </g>

        {/* Height dimension */}
        <g>
          <line x1={dimLineX} y1={topBlock.y} x2={dimLineX} y2={GROUND_Y} stroke="#444" strokeWidth={0.5} />
          <line x1={dimLineX - 4} y1={topBlock.y} x2={dimLineX + 4} y2={topBlock.y} stroke="#444" strokeWidth={0.5} />
          <line x1={dimLineX - 4} y1={GROUND_Y} x2={dimLineX + 4} y2={GROUND_Y} stroke="#444" strokeWidth={0.5} />
          <text x={dimLineX + 8} y={(topBlock.y + GROUND_Y) / 2} fill="#555" fontSize={10} dominantBaseline="middle">
            {volumes.totalHeight.toFixed(1)} ft
          </text>
        </g>

        {/* Tooltip */}
        {hoveredKey && (
          <g>
            <rect x={tooltipPos.x + 12} y={tooltipPos.y - 28} width={220} height={24} rx={3} fill="#1a1a1a" stroke="#333" strokeWidth={0.5} />
            <text x={tooltipPos.x + 22} y={tooltipPos.y - 13} fill="#bbb" fontSize={9}>
              {VOLUME_TOOLTIPS[hoveredKey as VolumeType]}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

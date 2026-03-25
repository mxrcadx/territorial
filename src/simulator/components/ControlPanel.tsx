import { useState } from 'react';
import { useStore } from '../store';
import { VOLUME_COLORS, SECTION_ORDER } from '../engine/constants';

const VOLUME_LABELS: Record<string, string> = {
  compute: 'Compute',
  geothermal: 'Geothermal',
  cooling: 'Cooling',
  support: 'Support',
  circulation: 'Circulation',
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  description?: string;
  showInput?: boolean;
}

function Slider({ label, value, min, max, step, unit, onChange, description, showInput }: SliderProps) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-0.5">
        <span className="text-[11px] text-neutral-400 uppercase tracking-wider">{label}</span>
        {showInput ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return;
                const v = Number(raw);
                if (!isNaN(v) && v >= min && v <= max) onChange(v);
              }}
              className="w-12 bg-transparent border border-neutral-700 rounded px-1 py-0 text-[12px] text-white text-right tabular-nums focus:outline-none focus:border-neutral-500"
            />
            <span className="text-[12px] text-white tabular-nums">{unit}</span>
          </div>
        ) : (
          <span className="text-[13px] text-white font-medium tabular-nums">
            {value}{unit}
          </span>
        )}
      </div>
      {description && (
        <p className="text-[9px] text-neutral-600 mb-1.5 leading-tight">{description}</p>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 appearance-none bg-neutral-700 rounded cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D94040] [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#D94040] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
      />
    </div>
  );
}

function PrioritySlider() {
  const { priority, setPriority } = useStore();

  const priorityLabel = priority < 0.35
    ? 'Favoring efficient sites'
    : priority > 0.65
      ? 'Favoring hidden sites'
      : 'Balanced';

  return (
    <div className="mb-5">
      <div className="text-[11px] text-neutral-400 uppercase tracking-wider mb-0.5">Priority</div>
      <div className="flex justify-between text-[9px] text-neutral-500 mb-1">
        <span>EFFICIENCY</span>
        <span>CONCEALMENT</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={priority}
        onChange={(e) => setPriority(Number(e.target.value))}
        className="w-full h-1 appearance-none bg-neutral-700 rounded cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D94040] [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#D94040] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
      />
      <div className="text-[9px] text-neutral-500 mt-1 italic">{priorityLabel}</div>
    </div>
  );
}

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'site';
}

function Collapsible({ title, defaultOpen = true, children, variant = 'default' }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const borderClass = variant === 'site'
    ? 'border-b border-dashed border-neutral-700 bg-[#0F0F0F]'
    : 'border-b border-neutral-800';

  return (
    <div className={borderClass}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-4 pr-6 text-[11px] uppercase tracking-wider text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        {title}
        <span className="text-[10px]">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="px-4 pr-6 pb-4">{children}</div>}
    </div>
  );
}

function ViewToggle() {
  const { viewMode, setViewMode } = useStore();

  return (
    <div className="flex border-b border-neutral-800">
      <button
        onClick={() => setViewMode('section')}
        className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
          viewMode === 'section'
            ? 'text-white bg-[#1a1a1a]'
            : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        Section View
      </button>
      <button
        onClick={() => setViewMode('map')}
        className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
          viewMode === 'map'
            ? 'text-white bg-[#1a1a1a]'
            : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        Map View
      </button>
    </div>
  );
}

function MapOverlayControls() {
  const { showFavorability, setShowFavorability } = useStore();

  return (
    <Collapsible title="Map Overlays" defaultOpen={true}>
      <label className="flex items-center gap-2 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={showFavorability}
          onChange={(e) => setShowFavorability(e.target.checked)}
          className="w-3 h-3 rounded border-neutral-600 accent-[#D94040]"
        />
        <span className="text-[10px] text-neutral-400">Favorability heatmap</span>
      </label>
      <p className="text-[8px] text-neutral-600 leading-tight">
        Yellow = near geothermal field. Purple = far from heat source.
      </p>
    </Collapsible>
  );
}

export function ControlPanel() {
  const {
    viewMode,
    computeLoad, setComputeLoad,
    favorability, setFavorability,
    ambientTemp, setAmbientTemp,
    volumes,
  } = useStore();

  const totalVolume = volumes.compute + volumes.geothermal + volumes.cooling + volumes.support + volumes.circulation;

  return (
    <div className="w-[256px] min-w-[256px] h-screen bg-[#111111] border-r border-neutral-800 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 pr-6 py-4 border-b border-neutral-800">
        <h1 className="text-[13px] font-semibold text-white tracking-wide">TERRITORIAL</h1>
        <p className="text-[10px] text-neutral-500 mt-0.5">Compute Simulator</p>
        <p className="text-[9px] text-neutral-600 mt-2 leading-relaxed">
          You choose how much power and what matters most. The terrain decides what gets built.
        </p>
      </div>

      {/* View Toggle */}
      <ViewToggle />

      {/* Your Choices */}
      <Collapsible title="Your Choices">
        <Slider
          label="Power Demand"
          value={computeLoad}
          min={5} max={50} step={1}
          unit=" MW"
          onChange={setComputeLoad}
          description="How much energy this stack needs"
          showInput
        />
        <PrioritySlider />
      </Collapsible>

      {/* Map Overlays — only in map mode */}
      {viewMode === 'map' && <MapOverlayControls />}

      {/* Site Conditions — only in section mode */}
      {viewMode === 'section' && (
        <Collapsible title="Site Conditions" variant="site">
          <p className="text-[8px] text-neutral-600 mb-3 italic">
            Manual controls for testing. In later phases these come from the map automatically.
          </p>
          <Slider
            label="Heat Availability"
            value={favorability}
            min={0.1} max={1.0} step={0.05}
            unit=""
            onChange={setFavorability}
            description="How much geothermal energy is under this spot"
          />
          <Slider
            label="Air Temperature"
            value={ambientTemp}
            min={-15} max={15} step={1}
            unit="°C"
            onChange={setAmbientTemp}
            description="How cold it is here"
          />
        </Collapsible>
      )}

      {/* What This Produces */}
      <Collapsible title="What This Produces">
        <div className="space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-neutral-500">Total Height</span>
            <span className="text-white tabular-nums">{volumes.totalHeight.toFixed(1)} ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Total Volume</span>
            <span className="text-white tabular-nums">{totalVolume.toFixed(0)} ft³</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Wells Needed</span>
            <span className="text-white tabular-nums">{volumes.wellCount}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-neutral-500">Heat Multiplier</span>
            <div className="text-right">
              <span className="text-white tabular-nums">{volumes.heatMultiplier.toFixed(1)}×</span>
              {volumes.heatMultiplier > 1.1 && (
                <p className="text-[8px] text-neutral-600 mt-0.5 leading-tight max-w-[100px]">
                  Extra geothermal plant needed because this site has less heat underground
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-800 space-y-1.5">
            {SECTION_ORDER.map((key) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: VOLUME_COLORS[key] }}
                  />
                  <span className="text-neutral-400">{VOLUME_LABELS[key]}</span>
                </div>
                <span className="text-white tabular-nums whitespace-nowrap">
                  {volumes[key].toFixed(0)} ft³
                  {key === 'cooling' && volumes.coolingAtFloor && (
                    <span className="text-[8px] text-neutral-600 ml-1">passive</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

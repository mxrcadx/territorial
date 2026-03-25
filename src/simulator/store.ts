import { create } from 'zustand';
import { computeVolumes, type SiteConditions, type VolumeResultWithDeltas } from './engine/simulationEngine';
import type { GeoField, HighlandZone, DEMMeta, SuitabilityWeights } from './engine/suitabilityEngine';

type ViewMode = 'section' | 'map';

interface AppState {
  // View
  viewMode: ViewMode;

  // Your Choices
  computeLoad: number;         // MW
  priority: number;            // 0 (efficiency) to 1 (concealment)

  // Site Conditions (manual in Phase A, auto from map in later phases)
  favorability: number;        // 0.1 – 1.0
  ambientTemp: number;         // °C

  // Computed
  volumes: VolumeResultWithDeltas;

  // Derived from priority slider
  weights: SuitabilityWeights;

  // Phase B: Map data
  geoFields: GeoField[];
  highlandZones: HighlandZone[];
  demMeta: DEMMeta | null;
  selectedZoneIndex: number | null;
  hoveredFieldIndex: number | null;
  hoveredZoneIndex: number | null;

  // Show overlays
  showFavorability: boolean;
  showSuitability: boolean;

  // Actions
  setViewMode: (v: ViewMode) => void;
  setComputeLoad: (v: number) => void;
  setPriority: (v: number) => void;
  setFavorability: (v: number) => void;
  setAmbientTemp: (v: number) => void;
  setGeoFields: (f: GeoField[]) => void;
  setHighlandZones: (z: HighlandZone[]) => void;
  setDEMMeta: (m: DEMMeta) => void;
  setSelectedZone: (i: number | null) => void;
  setHoveredField: (i: number | null) => void;
  setHoveredZone: (i: number | null) => void;
  setShowFavorability: (v: boolean) => void;
  setShowSuitability: (v: boolean) => void;
}

function computeWeights(priority: number): SuitabilityWeights {
  return {
    geothermal:   0.5 * (1 - priority),
    buildability: 0.5 * (1 - priority),
    visibility:   priority,
  };
}

function recompute(state: { computeLoad: number; favorability: number; ambientTemp: number }): VolumeResultWithDeltas {
  const conditions: SiteConditions = {
    computeLoad: state.computeLoad,
    favorability: state.favorability,
    ambientTemp: state.ambientTemp,
  };
  return computeVolumes(conditions);
}

const initialState = {
  computeLoad: 25,
  priority: 0.5,
  favorability: 0.7,
  ambientTemp: 5,
};

export const useStore = create<AppState>((set, get) => ({
  viewMode: 'map' as ViewMode,

  ...initialState,
  volumes: recompute(initialState),
  weights: computeWeights(initialState.priority),

  geoFields: [],
  highlandZones: [],
  demMeta: null,
  selectedZoneIndex: null,
  hoveredFieldIndex: null,
  hoveredZoneIndex: null,
  showFavorability: true,
  showSuitability: false,

  setViewMode: (v) => set({ viewMode: v }),
  setComputeLoad: (v) => {
    const s = { ...get(), computeLoad: v };
    set({ computeLoad: v, volumes: recompute(s) });
  },
  setPriority: (v) => {
    set({ priority: v, weights: computeWeights(v) });
  },
  setFavorability: (v) => {
    const s = { ...get(), favorability: v };
    set({ favorability: v, volumes: recompute(s) });
  },
  setAmbientTemp: (v) => {
    const s = { ...get(), ambientTemp: v };
    set({ ambientTemp: v, volumes: recompute(s) });
  },
  setGeoFields: (f) => set({ geoFields: f }),
  setHighlandZones: (z) => set({ highlandZones: z }),
  setDEMMeta: (m) => set({ demMeta: m }),
  setSelectedZone: (i) => set({ selectedZoneIndex: i }),
  setHoveredField: (i) => set({ hoveredFieldIndex: i }),
  setHoveredZone: (i) => set({ hoveredZoneIndex: i }),
  setShowFavorability: (v) => set({ showFavorability: v }),
  setShowSuitability: (v) => set({ showSuitability: v }),
}));

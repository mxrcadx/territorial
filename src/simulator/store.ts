import { create } from 'zustand';
import { computeVolumes, type SiteConditions, type VolumeResultWithDeltas } from './engine/simulationEngine';
import type { GeoField, HighlandZone, DEMMeta, SuitabilityWeights } from './engine/suitabilityEngine';
import { placeStacks, type Stack, type Cluster } from './engine/placementEngine';

type ViewMode = 'section' | 'map';
type Season = 'summer' | 'winter';
type Topology = 'ring' | 'star';

const SEASON_TEMP: Record<Season, number> = { summer: 10, winter: -5 };

interface AppState {
  // View
  viewMode: ViewMode;

  // Your Choices (Phase A section view)
  computeLoad: number;         // MW (per-stack, for section view)
  priority: number;            // 0 (efficiency) to 1 (concealment)

  // Site Conditions (manual in section view)
  favorability: number;        // 0.1 – 1.0
  ambientTemp: number;         // °C

  // Computed (section view)
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

  // Phase C: Simulation
  totalComputeDemand: number;  // MW (10–2000)
  stacks: Stack[];
  clusters: Cluster[];
  selectedStackId: string | null;
  hoveredStackId: string | null;
  visiblePhase: number;        // 1–5
  season: Season;
  topology: Topology;

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
  setTotalComputeDemand: (v: number) => void;
  setSelectedStack: (id: string | null) => void;
  setHoveredStack: (id: string | null) => void;
  setVisiblePhase: (v: number) => void;
  setSeason: (v: Season) => void;
  setTopology: (v: Topology) => void;
  runSimulation: () => void;
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

  // Phase C defaults
  totalComputeDemand: 100,
  stacks: [],
  clusters: [],
  selectedStackId: null,
  hoveredStackId: null,
  visiblePhase: 5,
  season: 'summer' as Season,
  topology: 'ring' as Topology,

  setViewMode: (v) => set({ viewMode: v }),
  setComputeLoad: (v) => {
    const s = { ...get(), computeLoad: v };
    set({ computeLoad: v, volumes: recompute(s) });
  },
  setPriority: (v) => {
    set({ priority: v, weights: computeWeights(v) });
    // Re-run simulation if zone selected (weights changed)
    setTimeout(() => get().runSimulation(), 0);
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
  setSelectedZone: (i) => {
    set({ selectedZoneIndex: i, selectedStackId: null });
    // Auto-run simulation when zone selected
    setTimeout(() => get().runSimulation(), 0);
  },
  setHoveredField: (i) => set({ hoveredFieldIndex: i }),
  setHoveredZone: (i) => set({ hoveredZoneIndex: i }),
  setShowFavorability: (v) => set({ showFavorability: v }),
  setShowSuitability: (v) => set({ showSuitability: v }),
  setTotalComputeDemand: (v) => {
    set({ totalComputeDemand: v });
    setTimeout(() => get().runSimulation(), 0);
  },
  setSelectedStack: (id) => set({ selectedStackId: id }),
  setHoveredStack: (id) => set({ hoveredStackId: id }),
  setVisiblePhase: (v) => set({ visiblePhase: v }),
  setSeason: (v) => {
    set({ season: v });
    setTimeout(() => get().runSimulation(), 0);
  },
  setTopology: (v) => set({ topology: v }),

  runSimulation: () => {
    const state = get();
    const { selectedZoneIndex, highlandZones, geoFields, weights, totalComputeDemand, season } = state;

    if (selectedZoneIndex === null || !highlandZones[selectedZoneIndex] || geoFields.length === 0) {
      set({ stacks: [], clusters: [] });
      return;
    }

    const zone = highlandZones[selectedZoneIndex];
    const ambientTemp = SEASON_TEMP[season];
    const result = placeStacks(totalComputeDemand, zone, geoFields, weights, ambientTemp);
    set({ stacks: result.stacks, clusters: result.clusters });
  },
}));

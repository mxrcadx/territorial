import { create } from 'zustand';
import { computeVolumes, type SiteConditions, type VolumeResultWithDeltas } from './engine/simulationEngine';

interface PhaseAState {
  // Your Choices
  computeLoad: number;         // MW
  priority: number;            // 0 (efficiency) to 1 (concealment)

  // Site Conditions (manual in Phase A, auto from map in later phases)
  favorability: number;        // 0.1 – 1.0
  ambientTemp: number;         // °C

  // Computed
  volumes: VolumeResultWithDeltas;

  // Derived from priority slider
  weights: { geothermal: number; buildability: number; visibility: number };

  // Actions
  setComputeLoad: (v: number) => void;
  setPriority: (v: number) => void;
  setFavorability: (v: number) => void;
  setAmbientTemp: (v: number) => void;
}

function computeWeights(priority: number) {
  // Left (0): geothermal 0.5 + buildability 0.5 + visibility 0.0
  // Right (1): visibility 1.0 + geothermal 0.0 + buildability 0.0
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

export const useStore = create<PhaseAState>((set, get) => ({
  ...initialState,
  volumes: recompute(initialState),
  weights: computeWeights(initialState.priority),

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
}));

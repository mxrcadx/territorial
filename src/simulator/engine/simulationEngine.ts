import { REF } from './constants';

// NOTE (Phase C): The current model assumes a single vertical stack arrangement.
// In Phase C, stacks will vary between single-level horizontal arrangements and
// multi-level vertical arrangements depending on site footprint constraints.
// Adjacent stacks in a cluster will be able to share volumes between them
// (e.g., shared geothermal plant, shared circulation corridors).
// Do not lock in assumptions that prevent horizontal or shared layouts.

export interface SiteConditions {
  computeLoad: number;         // MW
  favorability: number;        // 0.1 – 1.0 (heat availability)
  ambientTemp: number;         // °C
}

export interface VolumeResult {
  compute: number;      // ft³
  geothermal: number;   // ft³
  cooling: number;      // ft³
  support: number;      // ft³
  circulation: number;  // ft³
  totalHeight: number;  // ft
  wellCount: number;    // integer
  coolingAtFloor: boolean; // true when cooling is at minimum passive level
}

// Baseline volumes at reference conditions (5 MW, favorability 1.0, ambient 15°C)
const BASELINE_CONDITIONS: SiteConditions = {
  computeLoad: REF.REF_LOAD,
  favorability: 1.0,
  ambientTemp: 15,
};

let _baselineCache: VolumeResult | null = null;

function getBaseline(): VolumeResult {
  if (!_baselineCache) {
    _baselineCache = computeVolumesRaw(BASELINE_CONDITIONS);
  }
  return _baselineCache;
}

function computeVolumesRaw(conditions: SiteConditions): VolumeResult {
  const { computeLoad, favorability, ambientTemp } = conditions;
  const loadRatio = computeLoad / REF.REF_LOAD;

  // Compute volume: scales linearly with load
  const compute = REF.BASE_RACK_VOLUME * loadRatio;

  // Geothermal volume: scales with load, inversely with favorability
  // Low favorability → more plant infrastructure needed (deeper wells, more separators)
  const favorabilityMultiplier = 1 / Math.max(favorability, 0.1);
  const geothermal = REF.BASE_PLANT_VOLUME * loadRatio * favorabilityMultiplier;

  // Cooling volume: scales with load and ambient temperature
  // Warmer ambient → more cooling infrastructure needed
  // Floor at 0.2 — datacenters always need some cooling infrastructure
  const tempNormalized = Math.max(REF.COOLING_FLOOR, (ambientTemp - REF.COLD_THRESHOLD) / REF.TEMP_RANGE);
  const coolingAtFloor = tempNormalized <= REF.COOLING_FLOOR;
  const cooling = REF.BASE_COOLING_VOLUME * loadRatio * tempNormalized;

  // Support volume: scales with load
  const support = REF.BASE_SUPPORT_VOLUME * loadRatio;

  // Circulation volume: scales with load — stairs, corridors, vehicle access
  // NOTE (Phase C): inter-stack distance component will be added from cluster geometry
  const circulation = REF.BASE_CIRCULATION_VOLUME * loadRatio;

  // Total volume
  const totalVolume = compute + geothermal + cooling + support + circulation;

  // Height from total volume
  const totalHeight = totalVolume * REF.VOLUME_TO_HEIGHT;

  // Well count: based on compute load and MW per well pair
  const wellCount = Math.ceil(computeLoad / REF.MW_PER_WELL_PAIR);

  return {
    compute,
    geothermal,
    cooling,
    support,
    circulation,
    totalHeight,
    wellCount,
    coolingAtFloor,
  };
}

export interface VolumeResultWithDeltas extends VolumeResult {
  deltas: {
    compute: number;
    geothermal: number;
    cooling: number;
    support: number;
    circulation: number;
  };
  heatMultiplier: number;
}

export function computeVolumes(conditions: SiteConditions): VolumeResultWithDeltas {
  const result = computeVolumesRaw(conditions);
  const baseline = getBaseline();

  // Heat multiplier: how much extra geothermal plant is needed vs ideal site
  const heatMultiplier = 1 / Math.max(conditions.favorability, 0.1);

  return {
    ...result,
    heatMultiplier,
    deltas: {
      compute:     baseline.compute     > 0 ? result.compute     / baseline.compute     : 0,
      geothermal:  baseline.geothermal  > 0 ? result.geothermal  / baseline.geothermal  : 0,
      cooling:     baseline.cooling     > 0 ? result.cooling     / baseline.cooling     : 0,
      support:     baseline.support     > 0 ? result.support     / baseline.support     : 0,
      circulation: baseline.circulation > 0 ? result.circulation / baseline.circulation : 0,
    },
  };
}

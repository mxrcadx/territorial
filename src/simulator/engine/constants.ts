// All volumes in ft³, all dimensions in ft
// Conversion: 1 m³ = 35.3147 ft³, 1 m = 3.281 ft

const M3_TO_FT3 = 35.3147;

export const REF = {
  BASE_RACK_VOLUME: 500 * M3_TO_FT3,        // ft³ per 5 MW (reference unit)
  BASE_PLANT_VOLUME: 800 * M3_TO_FT3,       // ft³ per 5 MW at favorability 1.0
  BASE_COOLING_VOLUME: 200 * M3_TO_FT3,     // ft³ per 5 MW at max cooling need
  BASE_SUPPORT_VOLUME: 150 * M3_TO_FT3,     // ft³ per 5 MW
  BASE_CIRCULATION_VOLUME: 65 * M3_TO_FT3,  // ft³ per 5 MW — stairs, corridors, vehicle access
  REF_LOAD: 5,                               // MW (reference unit for scaling)
  COLD_THRESHOLD: -5,                        // °C (below this, cooling is at minimum floor)
  TEMP_RANGE: 20,                            // °C (normalization range)
  COOLING_FLOOR: 0.2,                        // minimum cooling multiplier (never zero)
  MW_PER_WELL_PAIR: 7.5,                     // MW average for Iceland high-enthalpy

  CABLE_FACTOR: 0.05 * M3_TO_FT3 / 3.281, // ft³ per ft of inter-stack distance

  // Height/width calibration: these are wide, squat industrial buildings — not towers.
  // At 50 MW / favorability 0.1 (worst case) → ~200 ft tall.
  // Typical 25 MW / favorability 0.7 → ~80–120 ft tall.
  VOLUME_TO_HEIGHT: 0.0003,                  // height(ft) = volume(ft³) × factor
  STACK_WIDTH: 350,                          // ft (wide industrial footprint)
} as const;

export const VOLUME_COLORS = {
  compute:     '#D94040',
  geothermal:  '#2D7A3A',
  cooling:     '#3B82F6',
  support:     '#E89020',
  circulation: '#6BCB77',
} as const;

// Section order bottom-to-top: geothermal, cooling, compute, support, circulation
export const SECTION_ORDER = [
  'geothermal',
  'cooling',
  'compute',
  'support',
  'circulation',
] as const;

export type VolumeType = typeof SECTION_ORDER[number];

export const VOLUME_TOOLTIPS: Record<VolumeType, string> = {
  compute:     'Server racks, network switches, liquid cooling loops',
  geothermal:  'Turbines, well connections, steam separators',
  cooling:     'Air handlers, heat exchangers, cold air intakes',
  support:     'Transformers, backup power, cable routing',
  circulation: 'Stairs, corridors, maintenance access',
};

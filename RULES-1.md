# RULES — Territorial Compute Simulator

Read this file at the start of every session. These are standing constraints.

## Project Context

This is a parametric simulation tool for an architectural thesis. It distributes geothermal-datacenter infrastructure across Iceland's volcanic highlands. The user sets compute demand, adjusts priority weightings, and the simulation places individuated structures on the terrain. Each structure's volumetric section is determined by its specific geographic position.

This app lives alongside an existing CesiumJS-based 3D Iceland geothermal visualization app in the same repository. Do not modify files in `src/explorer/` — that is the other app. The simulator lives in `src/simulator/`.

## Shared Resources

Both apps share:
- `public/data/` — DEM, GeoJSON data files
- `src/shared/` — common types, coordinate utilities, data loaders
- The Vite config handles both entry points

## Architecture

- React + Vite + TypeScript
- Zustand for state management
- Tailwind CSS for styling
- All simulation logic is client-side JavaScript — no backend
- 3D rendering: Three.js (not CesiumJS for the simulator)
- The existing explorer app uses CesiumJS via `resium`

## Cesium Ion Configuration

The Cesium Ion access token is stored in `.env` as `VITE_CESIUM_TOKEN`. Reference it in code as `import.meta.env.VITE_CESIUM_TOKEN`.

Available Cesium Ion assets (already in the account):
- **Asset 1**: Cesium World Terrain
- **Asset 3956**: ArcticDEM Release 4 (high-resolution terrain for Iceland)
- **Asset 3830182**: Google Maps 2D Satellite (imagery tiles)
- **Asset 3830183**: Google Maps 2D Satellite with Labels
- **Asset 2275207**: Google Photorealistic 3D Tiles

For the simulator's Phase D (3D terrain), use ArcticDEM (asset 3956) for terrain and Google Maps 2D Satellite (asset 3830182) for imagery. ArcticDEM has better resolution for Iceland than Cesium World Terrain.

For the existing explorer app, these same assets are available.

**Important:** Do not hardcode the token anywhere. Always read from `import.meta.env.VITE_CESIUM_TOKEN`. The `.env` file must be in `.gitignore`.

## Non-Negotiable Constraints

### Volume Types and Colors

There are exactly five volume types. These names and colors are fixed everywhere: section diagrams, map markers, 3D massing, legends, exports.

| Volume | Hex | Purpose |
|--------|-----|---------|
| Compute | `#D94040` | Server racks, network switches |
| Geothermal | `#2D7A3A` | Wellheads, turbine hall, separators |
| Cooling | `#3B82F6` | Air handling, heat exchangers |
| Support | `#E89020` | Transformers, UPS, power distribution, cables |
| Circulation | `#6BCB77` | Access stairs, maintenance corridors, roads |

Do not add new volume types without explicit instruction. Do not change these colors.

### Simulation Engine

The simulation engine (`src/simulator/engine/simulationEngine.ts`) contains pure functions with no side effects. It must remain a standalone module that can be tested independently. Do not put UI logic, state management, or API calls in the engine files.

The five volume formulas are defined in the spec document. Do not change the formula structure without explicit instruction. The reference constants in `constants.ts` may be tuned, but the formulas themselves are load-bearing.

### Stack Individuation

Every stack computes its own volumes from its own site conditions. Two stacks in the same cluster will have different sections if their local favorability, slope, or temperature differ. Stacks are never identical copies. The placement algorithm assigns site scores per-stack, and `computeVolumes()` is called independently for each one.

### Cluster Formation

Clusters form automatically when stacks are within 3 km of each other (single-linkage clustering). This is not a user toggle. The 3 km threshold is derived from EGS wellfield lateral reach and should not be changed without good reason. Cluster max radius: 8 km.

### Section Order

Volumes within a stack always follow this vertical order (bottom to top):
1. Geothermal (heaviest, connects to wells below)
2. Cooling
3. Compute
4. Support
5. Circulation

This order reflects thermodynamic logic and structural weight distribution. Do not rearrange.

## Interface Rules

- Dark background: `#0A0A0A`
- Monospace font throughout: JetBrains Mono or Fira Code
- Map/terrain view fills the viewport. Control panel is a narrow sidebar (240px).
- Control panel uses collapsible sections
- All sliders show numeric values alongside the handle
- Delta annotations on volume blocks: show multiplier vs. baseline (e.g., "2.3×")
- Stack section view slides into the sidebar when a stack is clicked; back button returns to stats

## Export Rules

Four export formats: GeoJSON, SVG, OBJ, DXF. Each has a dedicated button in the Export panel.

- **GeoJSON**: Full territorial simulation as FeatureCollection. Stack positions as Points, cluster boundaries as Polygons, circulation as LineStrings.
- **SVG**: Stack section diagram(s) as vector. Architectural line weights, standard volume colors, monospace labels.
- **OBJ**: 3D massing of all visible stacks as named groups with `.mtl` file. Coordinates in meters, Y-up.
- **DXF**: 3D massing on named layers matching volume types. Compatible with Rhino 8 and AutoCAD. Layer colors match the volume color system.

Filenames include state name (if active) or timestamp: `simulation_krafla_500mw_2026-03-24.geojson`

## State Management

Saved states persist to `localStorage`. Each state captures all input parameters plus the selected region polygon. Loading a state restores inputs and reruns the simulation. States are named by the user.

## Git Practices

- Push after every working feature
- Each commit gets a descriptive message about what changed
- Do not rename the `main` branch
- Update README.md before each push with any major new features
- Do not commit `node_modules/`, build artifacts, or `.env` files

## Build Phases

Build incrementally in this order. Do not skip ahead.

1. **Phase A**: Stack section calculator (sliders + section diagram, no map)
2. **Phase B**: Suitability surface (2D Iceland map with heatmap overlay)
3. **Phase C**: Stack placement + clustering (full simulation loop)
4. **Phase D**: 3D terrain (Three.js DEM mesh with satellite imagery)
5. **Phase E**: Circulation and corridors (infrastructure networks)
6. **Phase F**: State management + export (save/load, GeoJSON/SVG/OBJ/DXF)

Each phase must work and be tested before starting the next.

## Reference

Full parameter definitions, volume formulas, and site evaluation methodology: see `territorial_compute_simulator_spec.docx` and `territorial_compute_simulator_dev_outline.md` in the project root.

# Territorial Compute Simulator — Development Outline

## Overview

A web-based parametric simulation tool that distributes geothermal-datacenter infrastructure across Iceland's volcanic highlands. The user sets a total compute demand, selects a region, adjusts priority weightings, and watches the simulation distribute individuated structures across the terrain. Each structure's volumetric section is determined by its specific position on the suitability surface.

The app is a thesis design tool, not a production planning system. It must be visually clear, spatially legible, and responsive to parameter changes in real time.

---

## Architecture

**Stack:** React (Vite)  
**3D Terrain:** CesiumJS (via `resium` React bindings) or Three.js with DEM mesh — decision deferred to Phase D. Phases A–C use 2D plan view.  
**State Management:** Zustand (lightweight, sufficient for this scale)  
**Computation:** All simulation logic runs client-side in JavaScript. No backend.  
**Data:** Static GeoJSON and GeoTIFF files loaded at startup.  
**Styling:** Tailwind CSS. Dark interface, map-dominant layout.

---

## Data Files Required

All data lives in `/public/data/`. The app loads these at startup.

| File | Format | Description | Status |
|------|--------|-------------|--------|
| `iceland_dem.tif` | GeoTIFF | 30m elevation model of Iceland | User has this. Needs downsampling for browser (target: 90m or 250m for initial load, full 30m for selected region). |
| `geothermal_fields.geojson` | GeoJSON | Point features for 10 known high-enthalpy fields. Properties: `name`, `lat`, `lon`, `reservoir_temp_c`, `confidence` (0–1). | To create manually. See spec Section 4.1 for field list. |
| `roads.geojson` | GeoJSON | Line features for Route 1, F35, F26, and other major roads. | Extract from OpenStreetMap via Overpass API. |
| `glaciers.geojson` | GeoJSON | Polygon features for glacier extents. | Available from LMÍ open data. |
| `highland_zones.geojson` | GeoJSON | Polygon features for predefined selectable zones (Hengill area, Krafla area, Kerlingarfjöll, etc.). | To digitize manually. 5–8 zones. |
| `viewshed.tif` | GeoTIFF | Pre-computed visibility raster (0–1). | To compute offline from DEM + roads. Not needed for Phase A–C; use placeholder (uniform 0.5) until available. |

**DEM handling note:** The raw 30m DEM for all of Iceland is too large for browser memory. Strategy: ship a downsampled 250m version for the territorial view, and load full-resolution 30m tiles on demand when the user selects a region. Alternatively, pre-compute the suitability rasters offline and ship only those (much smaller: one float per cell for each layer).

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  HEADER BAR (app title, phase indicator, region)    │
├────────────┬────────────────────────────────────────┤
│            │                                        │
│  CONTROL   │                                        │
│  PANEL     │            MAP / TERRAIN VIEW          │
│  (240px)   │                                        │
│            │                                        │
│  - Sliders │                                        │
│  - Stats   │                                        │
│  - Legend  │                                        │
│            │                                        │
├────────────┤                                        │
│  STACK     │                                        │
│  SECTION   │                                        │
│  (slides   │                                        │
│   in when  │                                        │
│   stack    │                                        │
│   clicked) │                                        │
└────────────┴────────────────────────────────────────┘
```

- Map fills the viewport. Control panel is a fixed-width sidebar on the left.
- Stack section view replaces the stats area in the sidebar when a stack is selected. Back button returns to stats.
- Dark background (#0A0A0A). Map is the brightest element.
- All text in monospace (JetBrains Mono or similar).

---

## Color System

Volume colors are fixed across all views:

| Volume | Color | Hex |
|--------|-------|-----|
| Compute | Warm red | `#D94040` |
| Geothermal | Dark green | `#2D7A3A` |
| Cooling | Blue | `#3B82F6` |
| Support | Amber/orange | `#E89020` |
| Circulation | Light green | `#6BCB77` |

Suitability surface overlay: yellow (high) → dark purple (low), semi-transparent.

Interface accent color: `#D94040` (same as compute — the primary variable).

---

## Phase A: Stack Section Calculator

**Goal:** Validate volume scaling formulas. No map, no terrain.

### Components

**`App.tsx`** — Root. Renders `ControlPanel` and `StackSection` side by side.

**`ControlPanel.tsx`** — Sliders for:
- `computeLoad` (5–50 MW, step 1)
- `favorability` (0.1–1.0, step 0.05)
- `ambientTemp` (-15 to +15 °C, step 1)
- `interStackDistance` (0–5000 m, step 100)
- `sharingFactor` (0.5–1.0, step 0.05)

Each slider shows its current value. Below sliders: computed statistics (total stack height, volume breakdown in m³, well count).

**`StackSection.tsx`** — SVG or Canvas rendering of the stack as a vertical bar chart. Five colored rectangular blocks stacked vertically, heights proportional to computed volume. Labels on each block showing volume name and size. Animates smoothly when values change (CSS transitions on height).

The section should read as an architectural drawing, not a chart. Thin black outline on each volume. Small gap (2px) between volumes. Proportions calibrated so that a 50 MW stack at favorability 0.3 (worst case, largest geothermal volume) fills the available height. Volume widths can vary by type (compute is widest, circulation is narrower) or remain uniform — test both and choose what reads better.

**`simulationEngine.ts`** — Pure functions, no side effects. This module contains all formulas and is reused in every subsequent phase.

```typescript
interface SiteConditions {
  computeLoad: number;        // MW
  favorability: number;       // 0.1 – 1.0
  ambientTemp: number;        // °C
  interStackDistance: number;  // meters (to nearest neighbor)
  sharingFactor: number;      // 0.5 – 1.0 (1.0 = isolated, 0.5 = dense cluster)
}

interface VolumeResult {
  compute: number;     // m³
  geothermal: number;  // m³
  cooling: number;     // m³
  support: number;     // m³
  circulation: number; // m³
  totalHeight: number; // m
  wellCount: number;   // integer
}

function computeVolumes(conditions: SiteConditions): VolumeResult
```

**Reference values (hardcoded constants):**

```typescript
const REF = {
  BASE_RACK_VOLUME: 500,      // m³ per 5 MW (reference unit)
  BASE_PLANT_VOLUME: 800,     // m³ per 5 MW at favorability 1.0
  BASE_COOLING_VOLUME: 200,   // m³ per 5 MW at max cooling need
  BASE_SUPPORT_VOLUME: 150,   // m³ per 5 MW
  CABLE_FACTOR: 0.05,         // m³ per meter of inter-stack distance
  INTRA_CIRCULATION: 100,     // m³ fixed per stack
  REF_LOAD: 5,                // MW (reference unit for scaling)
  COLD_THRESHOLD: -5,         // °C (below this, cooling volume = 0)
  TEMP_RANGE: 20,             // °C (normalization range)
  MW_PER_WELL_PAIR: 7.5,      // MW average for Iceland high-enthalpy
  VOLUME_TO_HEIGHT: 0.02,     // conversion factor: height(m) = volume(m³) × factor
  STACK_WIDTH: 50,            // m (assumed uniform footprint width for height calc)
};
```

### Deliverable
Single-page app. Five sliders on the left, animated section diagram on the right. Changing any slider instantly updates the section. Delta annotations on each volume block: "2.3× baseline" when geothermal is inflated by low favorability, "0.1× baseline" when cooling is minimal.

---

## Phase B: Suitability Surface

**Goal:** Display Iceland terrain with interactive suitability overlay.

### New Components

**`MapView.tsx`** — 2D plan view of Iceland. Initially: render the DEM as a grayscale heightmap image (pre-render from GeoTIFF to PNG if needed for performance). Overlay the suitability surface as a colored semi-transparent layer. Render geothermal field points as markers. Render roads as lines. Render glacier extents as exclusion polygons. Render highland zone boundaries as clickable outlines.

**`suitabilityEngine.ts`** — Functions to compute the three sub-layers and composite:

```typescript
function computeFavorability(lat: number, lon: number, fields: GeothermalField[]): number
function computeBuildability(slope: number, geology: number, hazard: number): number
function computeVisibility(viewshedValue: number): number
function compositeSuitability(fav: number, build: number, vis: number, weights: Weights): number
```

For Phase B, favorability is computed analytically (distance decay from field points — no raster needed). Buildability uses slope derived from DEM. Visibility uses placeholder uniform value until viewshed raster is available.

**`RegionSelector.tsx`** — Handles two modes:
1. Click a predefined highland zone polygon to select it.
2. Draw a custom polygon on the map (click-to-place vertices, double-click to close).

Selected region is highlighted. Everything outside dims.

### Controls
Add to existing panel:
- Three priority weight sliders (geothermal, visibility, buildability). Auto-normalize to sum = 1.0.
- Region selection indicator.
- Regional statistics: area (km²), average suitability, estimated carrying capacity.

### Deliverable
Interactive 2D map of Iceland with suitability heatmap that updates in real time as priority weights change. Predefined zones clickable. No stacks placed yet.

---

## Phase C: Stack Placement + Clustering

**Goal:** The core simulation loop. User sets demand, stacks appear on map, clusters form, sections respond to position.

### New Components

**`placementEngine.ts`** — The placement algorithm:

```typescript
interface Stack {
  id: string;
  position: [number, number];    // lat, lon
  computeLoad: number;           // MW
  volumes: VolumeResult;
  siteScores: { favorability: number; buildability: number; visibility: number };
  clusterId: string | null;
  phase: number;                 // 1–5
}

interface Cluster {
  id: string;
  stackIds: string[];
  centroid: [number, number];
  sharedPlantPosition: [number, number];
  totalCompute: number;
  mstEdges: [string, string][];  // pairs of stack IDs
}

function placeStacks(
  totalDemand: number,
  region: Polygon,
  suitabilitySurface: Float32Array,
  weights: Weights,
  fields: GeothermalField[],
  dem: DEMData
): { stacks: Stack[]; clusters: Cluster[] }
```

Algorithm (from spec Section 6.3):
1. Compute composite suitability for selected region.
2. Determine stack count: `ceil(totalDemand / 50)`. Distribute load evenly.
3. Place first stack at highest-scoring cell.
4. Each subsequent stack: highest-scoring cell ≥500m from any existing stack.
5. Single-linkage clustering at 3km radius.
6. Compute shared geothermal facility per cluster. Apply sharing factor.
7. MST within each cluster for inter-stack circulation.
8. Size all volumes per stack using `computeVolumes()` with position-specific site scores.
9. Assign phase numbers in order of suitability score.

**`StackMarker.tsx`** — Renders a single stack on the 2D map as a small vertical bar chart (the section diagram, miniaturized). Five colored segments. Height proportional to total stack height. Clickable.

**`ClusterOverlay.tsx`** — Renders cluster boundaries (convex hull of member stacks, buffered), MST edges as lines between stacks, and shared geothermal facility as a distinct marker at cluster centroid.

**`InterClusterNetwork.tsx`** — Renders ring or star topology connections between cluster centroids.

### Updated Controls
- `totalComputeDemand` slider (10–2000 MW, logarithmic scale recommended for usability).
- `phase` slider (1–5 discrete). Filters which stacks/clusters are visible.
- `topology` toggle (Ring / Star).
- `season` toggle (Summer / Winter) — adjusts ambient temp used in volume calculations.

### Stack Detail Panel
When a stack is clicked:
- Sidebar switches to section view (reuse `StackSection` from Phase A, now populated with real site data).
- Show site scores: favorability, buildability, visibility.
- Show delta annotations: "Geothermal volume: 2,400 m³ (1.8× baseline — favorability 0.42)".
- Show cluster membership and sharing factor.
- Back button returns to stats view.

### Deliverable
Full simulation: adjust compute demand, watch stacks populate the terrain, click any stack to see its unique section. Clusters form and dissolve as stacks move. Phase slider reveals growth sequence.

---

## Phase D: 3D Terrain

**Goal:** Replace 2D plan view with 3D terrain.

### Approach Options (decide at implementation time)

**Option 1: CesiumJS via `resium`**
- Pros: built-in globe, terrain tiles, satellite imagery, mature ecosystem.
- Cons: large bundle, Cesium Ion account needed for terrain tiles, less control over rendering style.

**Option 2: Three.js + DEM mesh**
- Pros: full rendering control, can match dark UI aesthetic, lighter weight.
- Cons: must build terrain mesh from DEM, handle camera controls, source satellite tiles separately.

**Option 3: Deck.gl TerrainLayer**
- Pros: good 2D-to-3D transition, integrates with Mapbox, handles large datasets.
- Cons: less architectural feel, Mapbox token needed.

Recommendation: Three.js for maximum aesthetic control. The app should feel like an architectural tool, not a GIS viewer.

### Stack Rendering in 3D
Each stack becomes an extruded group of colored boxes sitting on the terrain mesh at its lat/lon position. Same color coding, same proportional heights as the 2D section. Camera orbits, zooms, tilts. Clicking a stack highlights it and opens the section panel.

### Satellite Imagery
Drape satellite tiles over the DEM mesh. The Cesium Ion account has Google Maps 2D Satellite (asset 3830182) and ArcticDEM Release 4 (asset 3956) already loaded. ArcticDEM provides higher-resolution terrain for Iceland than default Cesium World Terrain. Token is in `.env` as `VITE_CESIUM_TOKEN`.

If using Three.js instead of CesiumJS for the simulator, fetch terrain tiles from Cesium Ion's quantized mesh API and satellite tiles from the imagery API using the token. If using CesiumJS via `resium`, use `Cesium.IonImageryProvider.fromAssetId(3830182)` for imagery and `Cesium.CesiumTerrainProvider.fromIonAssetId(3956)` for ArcticDEM terrain.

---

## Phase E: Circulation and Corridors

**Goal:** Complete the territorial figure with infrastructure networks.

### Additions
- Inter-stack circulation rendered as 3D lines/tubes following terrain between stacks within a cluster (MST edges from Phase C, now with 3D terrain following).
- Inter-cluster corridors rendered as heavier lines between cluster centroids (ring or star topology).
- Corridor routing: simple A* pathfinding on the DEM avoiding steep slopes (>30°) and glacier polygons. If too complex, use straight lines with terrain draping.
- Phase slider now also controls corridor visibility: corridors appear when both connected clusters are visible in the current phase.

### Statistics Panel Updates
- Total inter-stack circulation length (km).
- Total inter-cluster corridor length (km).
- Estimated cable/pipe material (derived from lengths × cross-section factors).

---

## Phase F: State Management and Export

**Goal:** Save/load simulation states and export geometry for use in CAD, GIS, and thesis production workflows.

### Save / Load State System

**`StateManager.tsx`** — Collapsible "States" section in the control panel. Contains:
- **Save State** button: captures the entire current parameter set (demand, weights, season, phase, topology, selected region) plus all computed results (stack positions, volumes, cluster assignments) as a named snapshot. User provides a short name (e.g., "Krafla 500MW Phase3").
- **State selector** dropdown: lists all saved states. Selecting one restores all parameters and recomputes the simulation to match. The transition should animate: stacks slide to new positions, volumes resize, clusters reform.
- **Delete** button per saved state.
- States are persisted to `localStorage` so they survive page reloads. Each state is a serialized JSON blob of the Zustand store's input fields plus the selected region polygon.

This enables side-by-side comparison of different scenarios: "What does 200 MW concentrated in the Krafla region look like vs. 200 MW distributed across Hengill and Kerlingarfjöll?" Save both, toggle between them.

### Export Formats

**`exportEngine.ts`** — Pure functions that convert simulation state to downloadable files. Each format serves a different downstream workflow.

**GeoJSON** (`.geojson`)
- Exports the full territorial simulation as a GeoJSON FeatureCollection.
- Stack positions as Point features with properties: `id`, `computeLoad`, `favorability`, `volumes` (object with all five values), `clusterId`, `phase`, `totalHeight`.
- Cluster boundaries as Polygon features (convex hull of member stacks, buffered).
- Inter-stack circulation as LineString features (MST edges).
- Inter-cluster corridors as LineString features.
- Shared geothermal facilities as Point features.
- Opens directly in QGIS, Mapbox, or any GIS tool for further territorial analysis and drawing production.

**SVG** (`.svg`)
- Exports the currently selected stack's section diagram as a vector file.
- If no stack is selected, exports all stack sections arranged in a grid (one per stack, labeled with ID and site scores).
- Clean architectural line weights: thin outlines, volume fills using the standard color system, text labels in the monospace typeface.
- Imports directly into Illustrator or Inkscape for thesis panel composition.

**OBJ** (`.obj`)
- Exports the 3D massing of all visible stacks (filtered by current phase) as a Wavefront OBJ file.
- Each stack is a group of box meshes (one per volume), named by stack ID and volume type (e.g., `stack_04_compute`, `stack_04_geothermal`).
- Coordinates in meters, origin at the centroid of the selected region, Y-up.
- Includes an `.mtl` material file mapping each volume type to its standard color.
- If terrain is available (Phase D), optionally include a terrain mesh as a separate group.
- Opens in Rhino, Blender, 3ds Max, or any 3D modeling tool for rendering and further design development.

**DXF** (`.dxf`)
- Exports the 3D massing as a DXF file compatible with Rhino 8, AutoCAD, and BricsCAD.
- Each volume is a 3DFACE or POLYLINE-based solid on a named layer matching the volume type (`COMPUTE`, `GEOTHERMAL`, `COOLING`, `SUPPORT`, `CIRCULATION`).
- Layer colors match the standard color system (mapped to nearest AutoCAD color index).
- Stack sections can also be exported as 2D DXF: plan view (footprints) or elevation view (the section diagram as 2D polylines with hatching).
- Coordinates in meters, same origin convention as OBJ.
- Use `dxf-writer` npm package or generate DXF strings directly (the format is ASCII text, well-documented).

### Export UI

Collapsible "Export" section at the bottom of the control panel:
- Four buttons: `GeoJSON`, `SVG`, `OBJ`, `DXF`.
- Each triggers a browser download of the corresponding file.
- A checkbox: "Include terrain mesh" (for OBJ and DXF, only available in Phase D+).
- The exported filename includes the current state name if one is active, or a timestamp: `simulation_krafla_500mw_2026-03-24.geojson`.

### Libraries

- **OBJ export:** Build manually — the format is trivial (vertex list + face list as plain text).
- **DXF export:** Use `dxf-writer` package or hand-write ASCII DXF. For 3D solids, use 3DFACE entities grouped by layer.
- **SVG export:** Serialize the existing `StackSection` SVG DOM element, or generate from scratch using the same drawing logic.
- **GeoJSON export:** Serialize from the existing data structures — `JSON.stringify` with GeoJSON structure wrapping.

### Updated State Shape

Add to Zustand store:

```typescript
interface AppState {
  // ... existing fields ...

  // State management
  savedStates: { name: string; state: SerializedState }[];
  saveState: (name: string) => void;
  loadState: (name: string) => void;
  deleteState: (name: string) => void;

  // Export
  exportGeoJSON: () => void;
  exportSVG: () => void;
  exportOBJ: () => void;
  exportDXF: () => void;
}
```

### Updated File Structure

Add to `src/`:

```
src/
├── export/
│   ├── exportGeoJSON.ts
│   ├── exportSVG.ts
│   ├── exportOBJ.ts
│   ├── exportDXF.ts
│   └── stateSerializer.ts    # Serialize/deserialize Zustand state
├── components/
│   ├── StateManager.tsx       # Save/load/delete states UI
│   └── ExportPanel.tsx        # Export buttons and options
```

---

## Key Implementation Notes

### Performance
- Suitability surface computation should be memoized. Recompute only when weights change.
- Stack placement should debounce slider input (100ms delay) to avoid recalculating on every pixel of slider movement.
- For the 2D map phases, render the suitability surface as a pre-computed canvas image, not as individual DOM elements per cell.

### Responsiveness
- All volume calculations and section diagrams must update within one animation frame (~16ms) of a parameter change. The formulas are simple arithmetic; this should not be a bottleneck.
- Stack placement (Phase C) may take longer for high stack counts (>40 stacks at 2000 MW). Profile and optimize if needed; the greedy placement algorithm is O(n × cells) which could be slow on full-resolution DEM. Downsample the suitability surface to ~250m for placement, then snap placed stacks to nearest 30m cell.

### DEM Processing
- Use `geotiff.js` to read GeoTIFF files in the browser.
- Pre-compute slope raster from DEM at build time (Node.js script) and ship as a static asset, rather than computing in-browser.
- Latitude/longitude to pixel coordinate conversion must account for Iceland's projection (ISN93 / EPSG:3057 is the national grid, but GeoTIFFs may be in WGS84 / EPSG:4326). Handle both.

### State Shape (Zustand)

```typescript
interface AppState {
  // Inputs
  totalDemand: number;
  weights: { geo: number; vis: number; build: number };
  season: 'summer' | 'winter';
  phase: number;
  topology: 'ring' | 'star';
  selectedRegion: Polygon | null;
  selectedStackId: string | null;

  // Computed
  stacks: Stack[];
  clusters: Cluster[];
  suitabilitySurface: Float32Array | null;
  regionalStats: {
    area: number;
    avgSuitability: number;
    carryingCapacity: number;
    totalWells: number;
    totalLandArea: number;
  };

  // Actions
  setDemand: (mw: number) => void;
  setWeights: (w: Partial<Weights>) => void;
  setSeason: (s: 'summer' | 'winter') => void;
  setPhase: (p: number) => void;
  setTopology: (t: 'ring' | 'star') => void;
  selectRegion: (r: Polygon) => void;
  selectStack: (id: string | null) => void;
  runSimulation: () => void;
}
```

### File Structure

```
src/
├── App.tsx
├── main.tsx
├── store.ts                    # Zustand store
├── engine/
│   ├── simulationEngine.ts     # Volume formulas (Phase A)
│   ├── suitabilityEngine.ts    # Site scoring (Phase B)
│   ├── placementEngine.ts      # Stack placement + clustering (Phase C)
│   └── constants.ts            # Reference values
├── components/
│   ├── ControlPanel.tsx        # Sidebar with sliders and stats
│   ├── StackSection.tsx        # Section diagram (SVG)
│   ├── MapView.tsx             # 2D map (Phase B) or 3D terrain (Phase D)
│   ├── StackMarker.tsx         # Stack visualization on map
│   ├── ClusterOverlay.tsx      # Cluster boundaries + MST
│   ├── InterClusterNetwork.tsx # Ring/star topology lines
│   ├── RegionSelector.tsx      # Zone selection + custom polygon
│   └── Legend.tsx              # Volume color legend
├── data/
│   └── loader.ts               # GeoTIFF + GeoJSON loading utilities
└── utils/
    ├── geo.ts                   # Coordinate transforms, distance calcs
    ├── clustering.ts            # Single-linkage clustering
    └── mst.ts                   # Minimum spanning tree (Prim's or Kruskal's)
```

---

## Reference

Full parameter definitions, volume formulas, site evaluation methodology, and reference values are in the companion document: **Territorial Compute Simulator — Application Specification** (territorial_compute_simulator_spec.docx).

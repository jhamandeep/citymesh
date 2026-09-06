# Reference alignment audit

Objective: a small-city infrastructure/connectivity prototype with the Ericsson Site Digital Twin as the end-product reference. The user expanded the target to an entire 25–30-site private network including IBS, GBT, RTT and other types; the implementation contains 30 interconnected sites. This audit does not assert full enterprise feature parity.

Reference reviewed on 2026-09-06: https://www.ericsson.com/en/network-services/deployment/site-digital-twin

| Reference capability | Current authoritative implementation | Verification / remaining evidence |
| --- | --- | --- |
| Inspect physical site in 3D | `components/twin/site-viewer.tsx`, `lib/site-geometry.ts` | Real Three.js geometry, GLB parsing, raycasting and measurement tests pass; browser/WebGL visual QA not performed. |
| Accurate/updatable model at planning center | `lib/site-model.ts`, `/sites` editor | Dimension/identity validation, edit/persist/reload integration pass; geometry synthetic, no surveyed accuracy. |
| Open BIM, mixed-vendor assets | `lib/ifc-export.ts`, asset product fields | Independent IFC4 parser/geometry/metadata tests pass; export is equipment only, no full BIM round-trip. |
| Plan and analyze | `designChecks`, `changeSummary`, CSV and IFC export | Conflict, limits, power, revision-delta tests pass; no AI anomaly detection or engineering certification. |
| Predict and design | Draft geometry editor and baseline overlay | Control integration covers invalid design rejection and valid approval; advanced structural/RF prediction remains absent. |
| Build and collaborate | Field checks, evidence notes, JSON handoff, acceptance baseline | Full draft→approved→building→accepted→new-revision integration passes; manual versioned shared portfolio is available; per-user roles, live co-editing and AR remain absent. |
| Operate and maintain | Condition controls, asset-linked issues, history, city mapping | Issue lifecycle and network model tests pass; live telemetry not connected. |
| City infrastructure and connectivity | 30-site `/` private-network simulator plus a physical workspace for every site | 450 failure/scenario/demand combinations; dual-core failover, ring redundancy, access isolation and physical hardware degradation tests pass. |
| Deploy a usable end product | Same private Sites project, `/sites` route | Version 4 deployment succeeded and the private /sites route returned HTTP 200 with the connected BIM control. Each subsequent publish requires its own status and HTTP checks. |

The end-state remains partially demonstrated where the reference depends on production capture, integrations, collaboration and AI. Do not mark full reference equivalence from green prototype tests.

## Expanded portfolio verification

- 30 unique sites: 8 GBT, 8 RTT, 10 IBS, 2 small cells, 2 private cores.
- 254 initial physical equipment objects, each with a site-specific logical identity.
- 38 links with media, interfaces, capacity, latency and transport VLAN.
- All 30 projects pass model validation and complete the approval/build/acceptance lifecycle in tests.
- Real Three.js geometry checks cover mast, rooftop, indoor floors, street pole and core-room bounds.
- Control integration verifies direct navigation to all five site types and all 30 physical-twin links, search and site/link outage restoration.
- Saved physical faults reduce throughput or disconnect sites in the shared network routing calculation.
- The private deployment includes manual shared portfolio storage. Live telemetry and per-user collaboration controls remain outside the demonstrated prototype.


### Latest user request: entire-network 3D and end-to-end cabling
Implemented an orbitable 30-site overview and site-level selectable cable geometry; endpoint/port inspector; ODF patch/pigtail/splice/trunk details; local copper Ethernet, radio fiber, RF jumpers, IBS splitter/coax branches, DC and grounding; ordered active-core-to-antenna traces; JSON cable schedules. The default synthetic portfolio generates 610 local segments and 110 antenna traces. All 38 transport paths are represented. The 3D campus is schematic; engineering-grade surveys, cable loss budgets and live per-port telemetry remain gaps. Pixel-level browser QA has not been performed. Independent tests verify trace continuity, geometry and controls.

### Connected BIM evidence
The equipment-only export is now complemented by a connected site IFC4 handoff. `lib/ifc-export.ts` exports distribution elements, cable centerlines, uniquely nested ports and realized connectivity relationships. `ifc-connectivity.test.mjs` independently parses all 30 exports and verifies 610 segments, 1,220 ports, owners, endpoint names, coordinate mapping, metadata and unique IDs. `network-controls.test.mjs` exercises the actual download action and checks the resulting IFC contents. This closes the local wiring-loss gap in exports; it does not establish BIM round-trip, external viewer certification or entire-campus federated export.

IFC design reference: https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcRelConnectsPorts.htm (IFC4 entity signatures additionally checked against the installed web-ifc IFC4 schema).


### Survey workflow evidence
`components/twin/survey-panel.tsx` and `lib/survey-store.ts` replace session-only uploads with per-site binary persistence and provenance. The existing real GLB validator runs before replacement. Automated checks cover reopening the same site, another site's isolation, checksum mismatch, a simulated storage quota failure, invalid input, mode switching and removal. No real survey was supplied, so geometry accuracy, capture/reconstruction, coordinate registration and automatic asset identification remain unproven. The library is explicitly browser-local, not shared collaboration.

### Survey registration evidence
The survey viewer now supports persisted manual translation, yaw and scale, with a translucent equipment/cabling overlay. Pure Three.js tests verify transformed world coordinates, bounds, raycasts and original material restoration. Control integration verifies saved/restored alignment and overlay state; legacy survey records default to identity transforms. No supplied survey/control points are available, so a real-site registration residual and visual alignment accuracy remain unverified. Shared collaboration and live telemetry remain open gaps.


### Shared persistence and conflict evidence
A D1-backed whole-portfolio API and explicit publish/load controls now provide cross-device snapshot exchange. Tests verify 30-site round trips, same-base competing publishers (one succeeds, one conflicts), full rollback after a mid-batch failure, identity checks, same-origin writes, and preserving local edits after API failures. Local workerd/D1 integration passes. The Site remains owner-private; no collaborators were invited, no real user approval identities are implemented, and survey binaries are not shared. Production database provisioning and migration must be checked after this publish.

### Revision review and restoration evidence
Shared revisions now retain all 30 project records in the database. Historical review compares the selected snapshot against the current browser state and restores only into the browser; a later publish creates a new revision. Tests verify immutable prior values after later publishes, keyset pagination, pre-history current-version capture, rollback during snapshot creation, and explicit restore controls. This improves design/as-built review and traceability but does not provide per-user sign-off identities, automatic survey reconstruction or live network ingestion.

### Whole-network detailed 3D evidence
The former overview-only shapes have been supplemented with the same detailed site/equipment/cable models used by the individual workspaces. All 30 sites can be inspected in the map; level-of-detail switches distant sites to simpler shapes. Tests cover 254 asset transforms, 610 local cable meshes, 38 intersite termination positions, near/far visibility and picking. UI integration covers map-selected equipment and jumpers, and asset-specific site deep links. This closes the requirement gap where local detail required leaving the network view. Survey federation and browser visual/performance validation remain open.

2026-09-06: Added Austin geographic layers and an explicitly approximate per-site RF planner; visible paired microwave dish assemblies replace generic terminals. Added camera-facing inventory/wiring callouts in detailed site and campus LOD models. Remaining reference gaps include real survey-derived equipment recognition, engineering-calibrated RF/terrain/interference, surveyed routes, full detailed vendor component geometry, and authenticated approval identity. No live radio deployment or measured coverage is claimed.

### Component location and picking
Detailed site inspection now offers a keyboard-operable locator for inventory and derived wiring fixtures, with camera fitting based only on physical mesh bounds. A selected-equipment focus action provides repeatable close-up inspection. Selecting a fixture opens its connected cable details. Label leader lines no longer intercept equipment clicks. `inspection-geometry.test.mjs` verifies physical framing for all 388 initial inventory/fixture objects at three camera aspect ratios and checks leader-line raycast exclusion. Real browser label overlap and survey visual accuracy remain unverified.

User refinement: persistent detailed 3D callouts were removed in favor of pointer-hover tooltips for equipment, derived fixtures and cable endpoints. The network Links and site Layers controls are compact collapsed menus at the top left. The locator remains a keyboard/touch alternative. Hover-content tests cover all 30 sites; actual WebGL pointer position/visual layout is not certified by these tests.

### Geographic 3D and RF inventory coupling
The Austin planner defaults to an orbitable Three.js city map, with nine normally cached visible-area OpenStreetMap ground tiles registered to the same local metre coordinates as all 30 site models. 330 threshold contours represent 110 wired antenna branches, with the flat view optional. Geometry tests verify finite contours and less than 1 m tile/coordinate registration error across the modeled extent. This is a flat geographic ground plane with modeled site buildings/towers, not surveyed terrain or citywide building extrusion.
Coverage now derives branch orientation, position and availability from the equipment/cabling inventory. Tests cover radio outage removing only its branch, unmapped cabling, site outages, antenna rotation, ideal indoor splitter loss and omnidirectional indoor antennas. RF transmit/gain values remain scenario assumptions rather than measured hardware settings. Probe values use the strongest active branch and include antenna height at a 1.5 m receiver.
Reported UI fixes: the broad topology SVG minimum-size rule was incorrectly enlarging a nested Layers icon. Styling is now scoped to the topology drawing, and the 13 px icon has zero minimum dimensions; a computed-style regression check covers it. Inspection links use native navigation, forcing destination query parameters to be read on a fresh mount. No server errors beyond favicon 404 were found in the inspected production log window. Actual browser navigation/WebGL rendering has not been certified by the isolated checks.

### Whole-network coordinated IFC handoff
Added one downloadable IFC4 project containing 30 sites, 30 parametric structure meshes, 388 equipment/fixture objects, 641 physical cables, seven wireless annotations, 1,296 uniquely owned ports and 648 connection relationships. Independent web-ifc parsing verifies identifiers, endpoint transforms, containment references, global-ID uniqueness and safe STEP reference remapping. The IFC export remains the coordinated hypothetical design in local metre coordinates; the separately fetched real-city terrain/building context is not included in this export.

### Actual Austin environment and microwave LoS
Imported 8,181 USGS 3DEP elevation samples on a 25 m grid across a 2.5 × 2 km study area, and 2,043 City of Austin 2023 building footprints with source maximum/base elevations converted from US survey feet. Five heights are unknown. Source metadata/URLs and retrieval dates are retained in public data files. Reproducible import script is scripts/import-austin-environment.mjs.
Geographic 3D now drapes map imagery and analytical RF contours onto terrain, lifts site models and transport endpoints to their sampled ground heights, and renders the real footprint extrusions as one draw batch with hover identities. Buildings retain holes. Source maximum heights simplify roofs; unverified vertical datum alignment, later construction and vegetation are limitations. Coverage contours remain analytical rather than obstruction-aware; LoS does not automatically change simulated routing.
Seven selectable microwave profiles calculate direct-ray and 60% first-Fresnel clearance, include 4/3-earth curvature, add footprint crossings to the sample sequence, and mark unknown-height intersections. The selected ray and lower clearance boundary appear in 3D alongside a path-elevation chart. All current hypothetical links are blocked at their demonstration antenna heights in this dataset. Tests verify raw counts, coordinate interpolation, building geometry, all profiles, narrow-building detection, unknown handling and user controls. Actual browser visual performance is not established by these independent geometry/control checks.

### LoS-to-network scenario integration
A default-off “Apply modeled microwave LoS” control now excludes paths classified as blocked, insufficient-Fresnel or unverified. It uses the same source environment and frequency as the LoS panel, combines with manual/equipment failures, recalculates routes/throughput and shows before/after metrics. Reset clears the application toggle without changing the physical portfolio. At the current demo geometry, applying all seven exclusions changes reachable sites from 30 to 27. Tests verify no remaining route uses an excluded link, manual faults combine, disabling restores the baseline, and the actual toggle/reset controls update metrics. This is an explicit conservative model scenario, not live measured availability.

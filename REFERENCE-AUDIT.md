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

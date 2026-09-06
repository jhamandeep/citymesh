# Citymesh — 30-site private network digital twin prototype

## Run and verify

`npm install` then `npm run dev`. Open `/` for city connectivity and `/sites` for the physical site workflow. `npm run build` produces the hosted Worker bundle.

Verification:
- `node --experimental-strip-types private-network.test.mjs`
- `node --experimental-strip-types site-model.test.mjs`
- `node --experimental-strip-types site-geometry.test.mjs`
- `node --experimental-strip-types ifc-export.test.mjs`
- `node site-controls.test.mjs`
- `node network-controls.test.mjs`
- `npx tsc --noEmit`
- `npx oxlint app lib components/twin`

The integration harness uses jsdom and the actual form, tab, select and checkbox controls. Only Next navigation and the WebGL viewport are replaced by adapters. Separate Three.js checks exercise real geometry construction, raycast selection, surface distance and GLB parsing. These are not browser visual QA. The starter's unused UI catalog has pre-existing lint findings; authored application code is linted separately.

## Prototype workflow

1. **Inspect:** 30-site portfolio: 8 GBT, 8 RTT, 10 IBS, 2 small cells and 2 private cores. Type-specific 3D geometry and 254 initial equipment objects with vendor, product, serial, logical identity, dimensions, azimuth, power and weight. Search/select inventory and measure between surfaces. Load self-contained GLB files up to 20 MB for geometry inspection.
2. **Plan:** compare with accepted baseline; count added/modified/removed objects; check equipment bounding-box collisions, site-specific ground/height limits, outdoor antenna planning threshold and allocated power. Export CSV equipment schedules and IFC4 equipment solids with physical/logical metadata.
3. **Design:** add/remove antennas and edit equipment attributes, position, dimensions and azimuth. Proposed geometry changes appear in the 3D model. Approval locks geometry; a new revision unlocks it after acceptance.
4. **Build:** start from an approved revision, complete four field checks with evidence notes, and accept the as-built baseline. Missing evidence or unresolved high-severity issues block acceptance. JSON project export/import supports manual field handoff.
5. **Operate:** simulate equipment condition, record/resolve/reopen asset-linked issues, inspect history, and trace a failed site's impact to the city network. Complete gateway, antenna or radio loss disconnects its site. Partial radio faults reduce modeled throughput; both private core sources and all backhaul dependencies participate in routing.

Projects are explicitly browser-local, versioned JSON records under `citymesh.site-projects.v1`. The app reports persistence errors, validates imports before replacement and offers portable exports. GLB geometry is session-only and is not automatically mapped to inventory. Stored JSON does not contain uploads.

## Model fidelity

Jangaon is an illustrative model city, not a surveyed replica. The private network has 30 sites and 38 transport links. Traffic follows lowest-latency available paths from either private core; shared-link demand sets bottleneck throughput. Fiber ring links provide alternate paths, selected rooftops have microwave backups, and critical IBS facilities have additional fiber connections. Each link exposes synthetic interface IDs, VLAN and capacity. Upstream load is conservatively reserved even when downstream links limit delivery. It is not a packet, radio propagation, structural or electrical certification model.

IFC4 exports include rectangular equipment solids, stable GlobalIds, site containment and properties. Coordinates map the Y-up viewport into IFC Z-up, in metres. The independent web-ifc parser checks schema, Unicode labels, identities and generated geometry. Tower members, survey meshes, RF coverage and field issues are not part of the IFC export.

Ericsson reference: https://www.ericsson.com/en/network-services/deployment/site-digital-twin

## Remaining production capabilities

This prototype demonstrates the five deployment stages; it does not reproduce Ericsson's enterprise platform. Photogrammetry/LiDAR reconstruction, AI product recognition, AR installation, live OSS/BSS telemetry, authenticated multi-user approvals, real-time collaboration, workforce/procurement integration, certified engineering checks and complete BIM round-trip import are not implemented. Real city/site data has not been supplied.

The previous 12-node simulation and its optional WebMCP helper remain in the source as legacy modules; the visible application uses the new 30-site model. The visible application does not expose those legacy tools.


Full portfolio export/import preserves all 30 projects. Legacy north/south project IDs migrate to GBT-01 / GBT-05 without discarding the other 28 sites. Import validation rejects mismatched and duplicate identities. The network test covers 450 failure/scenario/demand combinations; detailed lifecycle tests cover every site. Control tests cover all type-specific routes, fault controls and site search. The floating type-selection menu's layout and WebGL pixel output are not validated by the jsdom harness.


# Citymesh — 30-site private network digital twin prototype

[![CI](https://github.com/jhamandeep/citymesh/actions/workflows/ci.yml/badge.svg)](https://github.com/jhamandeep/citymesh/actions/workflows/ci.yml)

A prototype digital twin for a 30-site private telecom network, built against the [Ericsson Site Digital Twin](https://www.ericsson.com/en/network-services/deployment/site-digital-twin) as a reference product. It covers the five deployment stages (inspect, plan, design, build, operate) with real 3D geometry, IFC4 BIM export, cable-level connectivity tracing, and RF/line-of-sight analysis over real Austin terrain and building data.

**This is a prototype, not a certified engineering tool.** The 30 sites are hypothetical, the routes are schematic, and no live monitoring feed is connected. Each section below states what is and is not verified; `REFERENCE-AUDIT.md` tracks the same claims against the reference product.

## Run and verify

```bash
npm install
npm run dev       # / = city connectivity, /sites = physical site workflow
npm run build     # hosted Worker bundle
```

Verification:

```bash
npm run verify            # format check + lint + typecheck + 31 unit suites
npm test                  # 31 unit suites on their own
npm run format:check      # oxfmt --check on authored code
npm run lint              # oxlint on authored code (lint:all includes the starter catalog)
npm run typecheck         # tsc --noEmit
```

The 6 workerd/D1/R2 integration suites need a built app, a migrated local database and a running server:

```bash
npm run build && npm run db:migrate
npm start                      # in one terminal
npm run test:integration       # in another
```

> **Known failure:** 4 of the 6 integration suites currently fail against a freshly migrated local database. `shared-api.test.mjs` expects two competing publishers to yield `[200, 409]` and observes `[200, 503]` — the losing writer raises instead of returning a clean compare-and-swap conflict. CI runs these suites non-blocking so the result stays visible.

The integration harness uses jsdom and the actual form, tab, select and checkbox controls. Only Next navigation and the WebGL viewport are replaced by adapters. Separate Three.js checks exercise real geometry construction, raycast selection, surface distance and GLB parsing. These are not browser visual QA. The starter's unused UI catalog has pre-existing lint findings; authored application code is linted separately.

## Security model

**There is no application-level authentication.** This is the single most important thing to understand before deploying this anywhere.

- All four write endpoints (`/api/portfolio`, `/api/photos`, `/api/surveys`, `/api/observations`) are guarded only by comparing the request's `Origin` header against the site's own origin. That is CSRF protection, not authorization — any non-browser client can set the header.
- The `GET` endpoints have no gate at all.
- Access control is inherited **entirely** from the hosting platform's owner-private gate. If that gate is removed, relaxed, or the app is deployed elsewhere without an equivalent, the shared portfolio, the R2 photo originals and the survey GLBs become world-readable and world-writable.
- Approval and acceptance in the workflow are unauthenticated. Revisions are immutable and complete, but they record no signer, so "approved" carries no identity.
- Uploader-supplied `source` labels on observations and photos are free text, not authenticated sensor or capture identities.

Bounded request sizes, checksum validation, same-origin mutation checks, compare-and-swap versioning and idempotent retries are implemented and tested. None of them substitute for authentication.

## Development

| Command | What it does |
| --- | --- |
| `npm run verify` | The full gate CI runs: format, lint, typecheck, 31 unit suites |
| `npm test` | 31 unit suites (`scripts/run-tests.mjs`) |
| `npm run test:integration` | 6 workerd/D1/R2 suites; needs a running server |
| `npm run test:all` | Both tiers |
| `npm run format` | Apply `oxfmt` to authored code |
| `npm run db:migrate` | Apply `drizzle/*.sql` to the local D1 emulator (idempotent) |

Authored code lives in `app/`, `lib/`, `components/twin/` and `scripts/`. `components/ui/` is the vendored shadcn catalog and `hooks/` is starter code; both carry pre-existing lint findings and are excluded from the gating lint scope.

Commit `f8d0584` reformatted every authored file with the project's own `oxfmt` config after they had been stored effectively minified. It is listed in `.git-blame-ignore-revs`; enable it locally with:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Releases

CI runs on every push and pull request. Tagging triggers a release build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow re-runs `npm run verify`, builds the Worker bundle, and publishes two archives plus `SHA256SUMS.txt`: the deployable bundle with its D1 migrations, and the USGS/Austin source data with its import script. **Releases do not deploy.** Deploying requires provisioning a real D1 database and R2 bucket, replacing the placeholder `database_id`, applying `drizzle/*.sql`, and running `wrangler deploy` yourself.

## Prototype workflow

1. **Inspect:** 30-site portfolio: 8 GBT, 8 RTT, 10 IBS, 2 small cells and 2 private cores. Type-specific 3D geometry and 254 initial equipment objects with vendor, product, serial, logical identity, dimensions, azimuth, power and weight. Search/select inventory and measure between surfaces. Load self-contained GLB files up to 20 MB for geometry inspection.
2. **Plan:** compare with accepted baseline; count added/modified/removed objects; check equipment bounding-box collisions, site-specific ground/height limits, outdoor antenna planning threshold and allocated power. Export CSV equipment schedules and IFC4 equipment solids with physical/logical metadata.
3. **Design:** add/remove antennas and edit equipment attributes, position, dimensions and azimuth. Proposed geometry changes appear in the 3D model. Approval locks geometry; a new revision unlocks it after acceptance.
4. **Build:** start from an approved revision, complete four field checks with evidence notes, and accept the as-built baseline. Missing evidence or unresolved high-severity issues block acceptance. JSON project export/import supports manual field handoff.
5. **Operate:** simulate equipment condition, record/resolve/reopen asset-linked issues, inspect history, and trace a failed site's impact to the city network. Complete gateway, antenna or radio loss disconnects its site. Partial radio faults reduce modeled throughput; both private core sources and all backhaul dependencies participate in routing.

Projects are explicitly browser-local, versioned JSON records under `citymesh.site-projects.v1`. The app reports persistence errors, validates imports before replacement and offers portable exports. GLB geometry is retained separately per site in IndexedDB and is not automatically mapped to inventory. Stored project JSON does not contain survey uploads; download each GLB and its provenance manifest for exchange.

## Model fidelity

Jangaon is an illustrative model city, not a surveyed replica. The private network has 30 sites and 38 transport links. Traffic follows lowest-latency available paths from either private core; shared-link demand sets bottleneck throughput. Fiber ring links provide alternate paths, selected rooftops have microwave backups, and critical IBS facilities have additional fiber connections. Each link exposes synthetic interface IDs, VLAN and capacity. Upstream load is conservatively reserved even when downstream links limit delivery. It is not a packet, radio propagation, structural or electrical certification model.

IFC4 exports include rectangular equipment solids, stable GlobalIds, site containment and properties. Coordinates map the Y-up viewport into IFC Z-up, in metres. The independent web-ifc parser checks schema, Unicode labels, identities and generated geometry. Tower members, survey meshes, RF coverage and field issues are not part of the IFC export.

Ericsson reference: https://www.ericsson.com/en/network-services/deployment/site-digital-twin

## Remaining production capabilities

This prototype demonstrates the five deployment stages; it does not reproduce Ericsson's enterprise platform. Photogrammetry/LiDAR reconstruction, AI product recognition, AR installation, live OSS/BSS telemetry, authenticated multi-user approvals, real-time collaboration, workforce/procurement integration, certified engineering checks and complete BIM round-trip import are not implemented. Real city/site data has not been supplied.

The previous 12-node simulation and its optional WebMCP helper have been removed; they were imported by nothing and are recoverable from git history. The visible application uses the 30-site model.


Full portfolio export/import preserves all 30 projects. Legacy north/south project IDs migrate to GBT-01 / GBT-05 without discarding the other 28 sites. Import validation rejects mismatched and duplicate identities. The network test covers 450 failure/scenario/demand combinations; detailed lifecycle tests cover every site. Control tests cover all type-specific routes, fault controls and site search. The floating type-selection menu's layout and WebGL pixel output are not validated by the jsdom harness.


## 30-site 3D cabling upgrade
The network home defaults to an orbitable 3D campus with all 30 sites and 38 selectable transport paths. The 2D topology remains available. Each physical site now includes selectable fiber, Ethernet, RF jumper/coax, DC and grounding geometry, with layer controls and selected termination markers.

`lib/cabling.ts` generates 624 local cable segments and explicit illustrative ODFs, splice trays, DC distribution, earth bars, microwave terminals and IBS splitters. These derived fixtures are separate from the 254 equipment inventory records. The schedule shows both endpoint assets, ports, connectors, cable specification, length basis and service. Export the selected site's cable schedule as JSON. All 110 initial antennas have an ordered physical trace from the active core, including intermediate site switching, optical patches, splices and radio conversion. Electrical support cables appear separately from the traffic trace.

Inter-site Ethernet services use optical trunks; Cat6A is local. The network layout, port names, connector schedule and lengths are synthetic design examples, not surveyed installation or field continuity records. Cable topology is generated from canonical asset IDs; new custom antennas remain unconnected until a mapping is implemented. No loss-budget, protection-sizing, coverage or live telemetry calculation is claimed.

Validation: `node cabling.test.mjs` checks all generated endpoints, all antenna trace continuity, both core routes, removal behavior and finite Three.js tube geometry. The existing model, topology, IFC, and UI-control tests remain applicable. WebGL pixels and browser layout have not been visually validated.

### Connected BIM handoff
Each cable panel offers **Export connected BIM · IFC4**. This exports the selected site's equipment and generated distribution fixtures, sampled cable centerlines matching the 3D routing, uniquely owned termination ports (`IfcRelNests`), and `IfcRelConnectsPorts` relationships realized by `IfcCableSegment` objects. Cable specifications, connectors, service, transport-link IDs, estimated lengths and design provenance are included. The original equipment-only export remains available.

Run `node ifc-connectivity.test.mjs` for parser verification across all 30 sites (610 cables, 1,220 ports). Exports cover local site wiring; remote sites, the intersite trunk geometry, tower structure and imported survey meshes are not bundled. Cable axes have no certified diameter/body model. External BIM tool interoperability and field accuracy remain unverified.


### Persistent site survey library
The physical site viewer restores one self-contained GLB per site from `citymesh.site-surveys.v1` IndexedDB storage. Imports are parsed before replacement; files retain source, capture date, notes, import time and SHA-256. The checksum is verified during storage and retrieval. Survey geometry is a distinct viewing mode: return to equipment/cables without deleting the survey, or download the original GLB and provenance manifest. Removal requires an explicit UI confirmation. Storage failures keep the newly opened model in the current session and preserve any previous saved file.

`node survey.test.mjs` verifies byte-exact persistence, site isolation, checksum and quota failures, and deletion isolation with fake-indexeddb. `node survey-controls.test.mjs` checks actual import, provenance entry, remount restoration, invalid replacement retention, view switching and removal controls, using the real GLB parser. These tests do not certify WebGL rendering or surveyed accuracy. Files are browser-local and are not uploaded or synchronized to other users/devices. Survey registration, photogrammetry and automatic inventory recognition remain unimplemented.

### Survey alignment and equipment overlay
Saved surveys support manual X/Y/Z translation (Y = elevation), clockwise yaw, uniform scale and a translucent equipment/cabling overlay. The transform applies to a wrapper around the imported scene, retaining the GLB's original node transforms and bytes. Alignment and overlay settings persist with the site and appear in the provenance export. Measurements use the transformed geometry. Equipment and cables remain selectable in overlay mode; the original parametric structure stays hidden.

`node survey-alignment.test.mjs` verifies transform order, rotated/scaled world coordinates, raycasting, bounds, non-accumulating edits, material restoration, backward-compatible defaults and unchanged stored GLB bytes. `node survey-controls.test.mjs` also verifies form submission and restored alignment/overlay settings. This is manual registration, not automatic georeferencing or certification of a surveyed fit.

### Shared portfolio across devices
Both the network and site workspaces expose a shared-store panel. The owner-private Site now has a D1 database (`DB`) with `portfolio_meta` and `portfolio_sites`. Browser edits remain local until the user publishes all 30 sites. Another device explicitly loads the shared snapshot. Initial loading never overwrites local edits. A client must load an existing shared version before publishing; stale saves receive HTTP 409 and must refresh/load before retrying. Survey GLBs and their alignment remain browser-local and are not uploaded by this operation.

The API validates all site identities and records, limits the request to 10 MB and individual site records to 1.5 MB, uses bound SQL, and commits the version and all rows in one D1 batch. A compare-and-swap plus request token prevents competing writes from creating a partial snapshot. GET responses are not cached and PUT requires the same Site origin. Access is governed by the existing owner-private Sites gate; no new viewers are invited. This is manual snapshot exchange, not real-time editing or role-based approval.

Schema source: `lib/portfolio-schema.ts`; generated migration: `drizzle/0000_mean_ben_grimm.sql`. Local initialization: `npx wrangler d1 execute DB --local --file drizzle/0000_mean_ben_grimm.sql --config dist/server/wrangler.json --persist-to .wrangler/state` after a build. `shared-portfolio.test.mjs` checks real SQLite transactions/rollback; `shared-api.test.mjs` checks a running localhost:3000 workerd/D1 API and writes only the local emulator; `shared-controls.test.mjs` checks explicit load/publish and conflict recovery.

### Retained shared revisions
Every accepted shared publish now retains a complete immutable snapshot of all 30 site projects. A pre-history deployment's current shared version is archived in the same transaction as its next publish. Conflicts and failed transactions create no partial history. The additive `0001_complete_archangel.sql` migration introduces `portfolio_snapshots` and `portfolio_revision_sites` without rewriting existing portfolio rows.

**Review shared history** lists 20 revisions at a time with keyset pagination. Open a revision to compare equipment changes, workflow stages and other changed records against the browser's current portfolio. **Restore to browser** updates only the working copy; publishing creates a new shared version under the existing concurrency check. Historical JSON is downloadable. GLB survey binaries remain separate. History has no automatic deletion policy or per-user approval identities.

`shared-portfolio.test.mjs` verifies retained snapshots, 25-version pagination, legacy-current capture and rollback during history insertion. `history-controls.test.mjs` verifies difference review and local-only restore. The localhost workerd/D1 API test verifies history and version reads alongside publish conflict behavior.

### One 3D map from campus to cable
The campus viewer now uses the same per-site equipment and cabling geometry as the physical workspaces. All 30 detailed site models are placed in a consistent schematic metre coordinate frame, with 254 initial equipment meshes and 624 local cable meshes. At close range, towers, rooftops, indoor floors, cabinets, radios, optical distribution fixtures and wiring appear directly in the map. Distant sites switch to simplified shapes for rendering efficiency. Click a site or use **Focus selected site**; **Show all 30 sites** restores the overview.

Inter-site paths meet the actual modeled ODF/splice or microwave terminal endpoints; wireless paths are straight dashed lines. Click a local cable for its termination inspector, or an equipment object for dimensions, identity and an asset-specific workspace link. The corresponding antenna trace can be selected directly from the map. Shared or local portfolio edits rebuild the scene from current equipment records.

`network-geometry.test.mjs` verifies every initial site, equipment transform, local cable mesh and inter-site endpoint, plus level-of-detail transitions and world-space picking. Network control integration verifies asset/jumper picks reach the appropriate inspectors. Detailed geometry and cabling remain synthetic; imported survey GLBs are not federated into the campus view. Browser pixel quality and frame rate are not measured by these tests.

## Austin RF and labeled microwave terminals

> **Superseded — see [No remaining microwave transport](#no-remaining-microwave-transport).** Modeled line-of-sight analysis found all seven proposed microwave paths blocked, and they were replaced with fiber. The dish assemblies, the microwave LoS scenario toggle and the wireless BIM annotations described in this section are no longer present in the application.

The geographic planner places all 30 hypothetical sites around Austin (30.2672 N, 97.7431 W), using the same 2.5 metre local coordinate scale as 3D. OpenStreetMap supplies the actual street basemap with visible attribution; only visible viewport tiles load through normal browser caching. Site placements and straight transport paths are illustrative, not surveyed or a claimed company deployment.
RF settings per site save in browser local storage. The explicit log-distance/sector model calculates EIRP, received power, noise floor, SNR and threshold coverage radius. It is an equivalent-sector prototype, separate from editable antenna inventory, without terrain, interference or building/floor propagation. These quantities are not RSRP/SINR. Reference: https://www.itu.int/rec/R-REC-P.525-4-201908-S/en
At the time of writing, all seven microwave paths had paired 1.2 m parabolic dish models with rim, feed horn, supports, outdoor radio, mounting pole and weatherproof GE/PoE termination. These were removed when the paths became fiber; no microwave dish geometry remains. Site and close-up campus models include camera-facing equipment/component callouts. Site labels can be toggled, preserve selection identities and are excluded from surface measurements.
Validation: RF model/projection/14 terminals and port coordinates; 30-site Three geometry; cable trace; all-site IFC; root/site interaction tests; TypeScript, authored lint and production build. Browser WebGL pixels, label collision avoidance and frame rate are not certified by these checks.

Latest inspection UI: detailed labels now appear only on hover. Compact Links/Layers menus sit at the top left of the 3D/map canvas. Use Locate component or Focus selected equipment for keyboard/touch inspection without hovering. This supersedes the earlier persistent-callout implementation.

Austin now defaults to 3D geographic inspection with optional Flat map. Street imagery is a flat georeferenced ground plane; infrastructure models and RF contours occupy that world. RF sectors follow real inventory IDs, modeled antenna directions and connected-radio conditions. Native inspection links reload the selected site/asset workspace. Topology sizing rules no longer affect toolbar icons.

Real Austin environment: the 3D map includes official USGS ground elevations and City of Austin 2023 building footprints/base/maximum heights. Choose a microwave path under LoS & path elevation; adjust frequency or use Focus LoS path to inspect direct and Fresnel clearance. Data are a bounded study-area snapshot, not live city conditions. Five source building heights are unknown; roofs are simplified extrusions, and the original network sites remain hypothetical. Current demo microwave paths intersect modeled obstructions. Source links and limitations are in the LoS panel.
Export 30-site BIM downloads the coordinated hypothetical infrastructure/wiring model; real-city context geometry is currently a separate viewer dataset.

In Network scenario lab, Apply modeled microwave LoS fed the terrain/building findings into route availability. This control is now disabled, because no microwave path remains to exclude. The control starts off and excludes blocked, insufficient-Fresnel or unverified paths conservatively. It displays reachability and delivered-throughput changes; Reset network scenarios disables it. The selected LoS frequency applies to all microwave paths in this scenario. Manual and saved equipment failures still apply.

For a coordinated BIM with real city context, check Include terrain & buildings in BIM before exporting. The option enables after source data load, uses terrain elevations for sites and connections, and preserves individual source building IDs. Unknown building heights remain footprint-only annotations. The resulting IFC is about 29 MB. Leave the option off for the smaller flat hypothetical design export.

## No remaining microwave transport

Every one of the seven proposed microwave backhaul paths was re-checked against the imported Austin environment (8,181 USGS 3DEP elevation samples, 2,043 City of Austin 2023 building footprints), and **all seven were blocked** at their proposed antenna heights — the direct ray or the 60% first-Fresnel zone intersected modeled terrain or buildings.

L14, L15, L17, L19, L20, L23 and L37 were therefore re-specified as 1 Gbps fiber, keeping their link IDs and endpoints. Their dishes and Ethernet feeds became ODF patches, pigtails and OS2 trunks throughout the 3D scene, the cable traces and the IFC export.

Current state: 30 reachable sites, 624 local cables, 38 optical inter-site paths, 374 equipment/fixture objects, and a coordinated IFC with 662 physical cables and no wireless annotations. The microwave UI is guarded and the LoS scenario toggle is disabled. Verified by `fiber-replacement.test.mjs`, `cabling.test.mjs`, `geo-rf.test.mjs` (asserts zero microwave dishes) and `ifc-environment.test.mjs`.

This is the most substantive result the prototype produced: real elevation and footprint data changed a transport design decision. The routes themselves remain schematic and no monitoring feed is connected.

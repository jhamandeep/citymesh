# Citymesh network digital twin

A small-city infrastructure simulator, built independently of the parent veterinary application.

Run `npm install`, then `npm run dev`. Production build: `npm run build`.
Run model checks with `node --experimental-strip-types simulation.test.mjs`.

The illustrative Jangaon topology includes 12 assets and 12 links: a central exchange, two aggregation cabinets, two cell towers, and public, residential, and industrial services. Positions and loads are synthetic, not surveyed city data.

Traffic follows shortest-hop paths from the exchange, using link array order to break ties. Shared-link demand determines each service's bottleneck throughput. This is a capacity model, not a packet-level or radio propagation simulator; upstream load is conservatively reserved even when a downstream bottleneck limits delivery. Power loss disables western assets without backup. A backed-up hospital still loses connectivity when its upstream cabinet fails.

Scenario and demand controls recalculate immediately, even when the clock is paused. A tick represents one simulated minute; no random changes are introduced. State resets when the page reloads. No live telemetry, real infrastructure control, backend persistence, or authentication inside the app is implemented; hosting access is managed by Sites.

The optional WebMCP tool configures the same state as the UI when supported. A supported validation context was not available, so its runtime contract has not been verified.

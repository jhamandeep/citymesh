import type { D1Database } from '@cloudflare/workers-types';
import type { Observation } from './observations.ts';
export async function readObservations(db: D1Database) {
  const rows = await db
    .prepare(
      'SELECT body FROM network_observations ORDER BY observed_at DESC LIMIT 1000',
    )
    .all<{ body: string }>();
  return rows.results.map((r) => JSON.parse(r.body) as Observation);
}
export async function writeObservations(
  db: D1Database,
  records: Observation[],
) {
  const received = new Date().toISOString();
  const results = await db.batch(
    records.map((r) =>
      db
        .prepare(
          'INSERT INTO network_observations(entity_key,observed_at,body,received_at) VALUES(?,?,?,?) ON CONFLICT(entity_key) DO UPDATE SET observed_at=excluded.observed_at,body=excluded.body,received_at=excluded.received_at WHERE excluded.observed_at>network_observations.observed_at',
        )
        .bind(r.key, r.observedAt, JSON.stringify(r), received),
    ),
  );
  return {
    accepted: results.reduce((n, r) => n + r.meta.changes, 0),
    ignored: results.filter((r) => r.meta.changes === 0).length,
    receivedAt: received,
  };
}

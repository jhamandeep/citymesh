import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { readObservations, writeObservations } from '@/lib/observation-store';
import { parseObservations } from '@/lib/observations';
import { readSharedPortfolio } from '@/lib/shared-portfolio';
import { createPortfolio } from '@/lib/site-model';
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const database = () => (env as unknown as { DB?: D1Database }).DB;
export async function GET() {
  const db = database();
  if (!db) return json({ error: 'Observation storage unavailable.' }, 503);
  try {
    return json({
      observations: await readObservations(db),
      serverTime: new Date().toISOString(),
    });
  } catch {
    return json({ error: 'Unable to read observations.' }, 503);
  }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json(
      { error: 'Use the observation import controls on this Site.' },
      403,
    );
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Send a JSON observation batch.' }, 415);
  const db = database();
  if (!db) return json({ error: 'Observation storage unavailable.' }, 503);
  let data: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    let total = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 512000) {
        await reader.cancel();
        return json({ error: 'Observation batch exceeds 500 KB.' }, 413);
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const part of parts) {
      bytes.set(part, at);
      at += part.byteLength;
    }
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: 'Invalid observation JSON.' }, 400);
  }
  try {
    const shared = await readSharedPortfolio(db);
    let records;
    try {
      records = parseObservations(data, shared.projects || createPortfolio());
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : 'Invalid observations.' },
        400,
      );
    }
    return json(await writeObservations(db, records));
  } catch {
    return json(
      {
        error:
          'Unable to save observations. No simulation values were changed.',
      },
      503,
    );
  }
}

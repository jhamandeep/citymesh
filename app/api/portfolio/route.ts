import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import {
  readSharedPortfolio,
  publishSharedPortfolio,
  validatePortfolio,
  readSharedHistory,
  readSharedVersion,
} from '@/lib/shared-portfolio';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}
export async function GET(request: Request) {
  const db = database();
  if (!db) return json({ error: 'Shared storage is not configured.' }, 503);
  try {
    const params = new URL(request.url).searchParams;
    const number = (key: string) => {
      const raw = params.get(key);
      if (raw === null) return undefined;
      if (
        !/^\d+$/.test(raw) ||
        !Number.isSafeInteger(Number(raw)) ||
        Number(raw) < 1
      )
        throw new Error('Invalid revision number.');
      return Number(raw);
    };
    let version: number | undefined, before: number | undefined;
    try {
      version = number('version');
      before = number('before');
    } catch {
      return json({ error: 'Invalid revision number.' }, 400);
    }
    if (params.get('history') === '1')
      return json(await readSharedHistory(db, before));
    if (version !== undefined) {
      const snapshot = await readSharedVersion(db, version);
      return snapshot
        ? json(snapshot)
        : json({ error: 'Shared revision not found.' }, 404);
    }
    return json(await readSharedPortfolio(db));
  } catch {
    return json(
      {
        error:
          'Shared storage is temporarily unavailable. Your browser portfolio is unchanged.',
      },
      503,
    );
  }
}
export async function PUT(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json(
      { error: 'Use the portfolio controls on this Site to publish.' },
      403,
    );
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Send a JSON portfolio.' }, 415);
  const db = database();
  if (!db) return json({ error: 'Shared storage is not configured.' }, 503);
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Missing portfolio.' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 10 * 1024 * 1024) {
        await reader.cancel();
        return json({ error: 'Portfolio exceeds 10 MB.' }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: 'Invalid JSON portfolio.' }, 400);
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('expectedVersion' in body) ||
    !('projects' in body)
  )
    return json({ error: 'Missing portfolio or version.' }, 400);
  try {
    if (
      !Number.isSafeInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 0
    )
      throw new Error('Invalid shared version.');
    validatePortfolio(body.projects);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Invalid portfolio.' },
      400,
    );
  }
  try {
    const result = await publishSharedPortfolio(
      db,
      body.expectedVersion as number,
      body.projects,
    );
    return result.conflict
      ? json(
          {
            error:
              'A newer shared version exists. Load it before publishing your next revision.',
          },
          409,
        )
      : json(result);
  } catch {
    return json(
      { error: 'Unable to publish. Your browser portfolio is unchanged.' },
      503,
    );
  }
}

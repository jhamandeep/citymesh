import { env } from 'cloudflare:workers';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { siteById } from '@/lib/private-network';
import { PHOTO_LIMIT, type PhotoRecord } from '@/lib/photo-store';
import {
  PhotoError,
  sharedPhotoList,
  readPhoto,
  publishPhoto,
  deleteSharedPhoto,
} from '@/lib/shared-photos';
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
function bindings() {
  const { DB, EVIDENCE } = env as unknown as {
    DB?: D1Database;
    EVIDENCE?: R2Bucket;
  };
  if (!DB || !EVIDENCE)
    throw new PhotoError('Shared photo storage is unavailable.', 503);
  return { db: DB, bucket: EVIDENCE };
}
function site(request: Request) {
  const params = new URL(request.url).searchParams,
    siteId = params.get('site') || '';
  if (!siteById(siteId)) throw new PhotoError('Choose a known site.');
  return { siteId, id: params.get('id') || '' };
}
function failure(e: unknown) {
  return json(
    {
      error:
        e instanceof PhotoError
          ? e.message
          : 'Shared photo storage is temporarily unavailable. Local evidence is unchanged.',
    },
    e instanceof PhotoError ? e.status : 503,
  );
}
export async function GET(request: Request) {
  try {
    const { db, bucket } = bindings(),
      { siteId, id } = site(request);
    if (!id) return json({ photos: await sharedPhotoList(db, siteId) });
    const row = await readPhoto(db, siteId, id);
    if (!row) return json({ error: 'Shared photo not found.' }, 404);
    const object = await bucket.get(row.object_key);
    if (!object) return json({ error: 'Photo original is unavailable.' }, 503);
    const info = JSON.parse(row.metadata);
    return new Response(object.body as unknown as ReadableStream, {
      headers: {
        'Content-Type': info.mime,
        'Content-Length': String(object.size),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(info.filename)}`,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'Use the photo controls on this Site.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;'))
    return json({ error: 'Send a photo and its metadata.' }, 415);
  try {
    const { db, bucket } = bindings(),
      { siteId } = site(request),
      reader = request.body?.getReader();
    if (!reader) throw new PhotoError('Missing photo.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > PHOTO_LIMIT + 16384) {
        await reader.cancel();
        throw new PhotoError('Photo exceeds 5 MB.', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let record: PhotoRecord, version: number;
    try {
      const form = await new Response(bytes, {
          headers: { 'Content-Type': request.headers.get('content-type')! },
        }).formData(),
        file = form.get('file'),
        raw = form.get('metadata');
      if (
        !(file instanceof File) ||
        typeof raw !== 'string' ||
        raw.length > 12000
      )
        throw new Error('Invalid upload');
      const parsed = JSON.parse(raw);
      version = parsed.portfolioVersion;
      record = {
        id: parsed.id,
        siteId,
        assetId: parsed.assetId,
        revision: parsed.revision,
        filename: parsed.filename,
        mime: parsed.mime,
        bytes: await file.arrayBuffer(),
        sha256: parsed.sha256,
        source: parsed.source,
        capturedAt: parsed.capturedAt,
        note: parsed.note,
        addedAt: parsed.addedAt,
      };
    } catch {
      throw new PhotoError('Invalid photo metadata or file.');
    }
    try {
      return json(await publishPhoto(db, bucket, record, version));
    } catch (e) {
      if (e instanceof PhotoError) throw e;
      if (
        e instanceof Error &&
        /photo|metadata|association|JPEG/i.test(e.message)
      )
        throw new PhotoError(e.message);
      throw e;
    }
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'Use the photo controls on this Site.' }, 403);
  try {
    const { db, bucket } = bindings(),
      { siteId, id } = site(request);
    if (!id) throw new PhotoError('Choose a photo.');
    await deleteSharedPhoto(db, bucket, siteId, id);
    return json({ removed: true });
  } catch (e) {
    return failure(e);
  }
}

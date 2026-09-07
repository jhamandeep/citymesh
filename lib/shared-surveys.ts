import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { validateSurvey, type SurveyRecord } from './survey-store.ts';
import { photoDigest } from './photo-store.ts';
export type SurveyMetadata = Omit<SurveyRecord, 'bytes'> & {
  byteLength: number;
};
export type SharedSurvey = {
  version: number;
  updatedAt: string;
  survey: SurveyMetadata | null;
};
type Row = {
  site_id: string;
  version: number;
  object_key: string | null;
  metadata: string | null;
  updated_at: string;
};
export class SurveyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function validateSurveyContainer(bytes: ArrayBuffer) {
  if (bytes.byteLength < 20 || bytes.byteLength > 20 * 1024 * 1024)
    throw new SurveyError('Choose a self-contained GLB up to 20 MB.');
  const view = new DataView(bytes);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new SurveyError('Invalid GLB header or length.');
  let offset = 12,
    jsonSeen = false;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength)
      throw new SurveyError('Truncated GLB chunk.');
    const length = view.getUint32(offset, true),
      kind = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > bytes.byteLength)
      throw new SurveyError('Invalid GLB chunk length.');
    if (!jsonSeen) {
      if (kind !== 0x4e4f534a)
        throw new SurveyError('GLB must start with a JSON chunk.');
      let doc;
      try {
        doc = JSON.parse(
          new TextDecoder().decode(new Uint8Array(bytes, offset + 8, length)),
        );
      } catch {
        throw new SurveyError('Invalid GLB scene description.');
      }
      if (
        doc.asset?.version !== '2.0' ||
        !Array.isArray(doc.meshes) ||
        !doc.meshes.length
      )
        throw new SurveyError('GLB must contain a glTF 2.0 mesh.');
      for (const resource of [...(doc.buffers || []), ...(doc.images || [])])
        if (resource.uri && !String(resource.uri).startsWith('data:'))
          throw new SurveyError(
            'Use embedded GLB resources; external files are not supported.',
          );
      jsonSeen = true;
    }
    offset += 8 + length;
  }
  if (!jsonSeen) throw new SurveyError('GLB scene is missing.');
}
export async function surveyRow(db: D1Database, site: string) {
  return db
    .prepare('SELECT * FROM shared_surveys WHERE site_id=?')
    .bind(site)
    .first<Row>();
}
export function surveySnapshot(row: Row | null): SharedSurvey {
  return row
    ? {
        version: row.version,
        updatedAt: row.updated_at,
        survey: row.metadata ? JSON.parse(row.metadata) : null,
      }
    : { version: 0, updatedAt: '', survey: null };
}
async function cleanup(bucket: R2Bucket, key: string | null | undefined) {
  if (key)
    try {
      await bucket.delete(key);
    } catch {
      console.warn('Unreferenced survey object requires cleanup.');
    }
}
export async function publishSurvey(
  db: D1Database,
  bucket: R2Bucket,
  record: SurveyRecord,
  expected: number,
) {
  try {
    validateSurvey(record);
    validateSurveyContainer(record.bytes);
  } catch (e) {
    throw e instanceof SurveyError
      ? e
      : new SurveyError(e instanceof Error ? e.message : 'Invalid survey.');
  }
  if ((await photoDigest(record.bytes)) !== record.sha256)
    throw new SurveyError('Survey checksum does not match its original.');
  if (!Number.isSafeInteger(expected) || expected < 0)
    throw new SurveyError('Invalid shared survey version.');
  const prior = await surveyRow(db, record.siteId);
  if ((prior?.version || 0) !== expected)
    throw new SurveyError(
      'A newer shared survey exists. Refresh before replacing it.',
      409,
    );
  const { bytes, ...details } = record,
    key = `surveys/${record.siteId}/${crypto.randomUUID()}`,
    updatedAt = new Date().toISOString(),
    metadata = JSON.stringify({ ...details, byteLength: bytes.byteLength });
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: 'model/gltf-binary' },
    customMetadata: { sha256: record.sha256 },
  });
  const result = await db
    .prepare(
      'INSERT INTO shared_surveys(site_id,version,object_key,metadata,updated_at) SELECT ?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM shared_surveys WHERE site_id=? AND version=?) ON CONFLICT(site_id) DO UPDATE SET version=excluded.version,object_key=excluded.object_key,metadata=excluded.metadata,updated_at=excluded.updated_at WHERE shared_surveys.version=?',
    )
    .bind(
      record.siteId,
      expected + 1,
      key,
      metadata,
      updatedAt,
      expected,
      record.siteId,
      expected,
      expected,
    )
    .run();
  if (result.meta.changes !== 1) {
    await cleanup(bucket, key);
    throw new SurveyError(
      'A newer shared survey exists. Refresh before replacing it.',
      409,
    );
  }
  await cleanup(bucket, prior?.object_key);
  return {
    version: expected + 1,
    updatedAt,
    survey: JSON.parse(metadata),
  } as SharedSurvey;
}
export async function removeSharedSurvey(
  db: D1Database,
  bucket: R2Bucket,
  site: string,
  version: number,
) {
  const prior = await surveyRow(db, site);
  if (!prior?.metadata) throw new SurveyError('Shared survey not found.', 404);
  const at = new Date().toISOString(),
    result = await db
      .prepare(
        'UPDATE shared_surveys SET version=version+1,metadata=NULL,object_key=NULL,updated_at=? WHERE site_id=? AND version=?',
      )
      .bind(at, site, version)
      .run();
  if (result.meta.changes !== 1)
    throw new SurveyError(
      'Shared survey changed. Refresh before removing it.',
      409,
    );
  await cleanup(bucket, prior.object_key);
  return { version: version + 1, updatedAt: at, survey: null };
}

'use client';
/* Originals are private same-origin files; they must not pass through an image optimization service. */
/* oxlint-disable next/no-img-element */
import { useEffect, useState } from 'react';
import type { PhotoRecord } from '@/lib/photo-store';
import type { SharedPhoto } from '@/lib/shared-photos';
import type { Equipment } from '@/lib/site-model';
const endpoint = (site: string, id = '') =>
  `/api/photos?site=${encodeURIComponent(site)}${id ? `&id=${encodeURIComponent(id)}` : ''}`;
async function response<T = unknown>(r: Response): Promise<T> {
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'string'
        ? data.error
        : 'Shared evidence unavailable.',
    );
  return data as T;
}
export default function SharedPhotos({
  siteId,
  local,
  equipment,
  onSelect,
}: {
  siteId: string;
  local: PhotoRecord[];
  equipment: Equipment[];
  onSelect: (id: string) => void;
}) {
  const [photos, setPhotos] = useState<SharedPhoto[]>([]),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState(''),
    [remove, setRemove] = useState('');
  const refresh = async () => {
    setBusy(true);
    try {
      const data = await response<{ photos: SharedPhoto[] }>(
        await fetch(endpoint(siteId), { cache: 'no-store' }),
      );
      setPhotos(data.photos);
      setMessage('Shared evidence refreshed.');
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Unable to load shared evidence.',
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    fetch(endpoint(siteId), { cache: 'no-store' })
      .then((r) => response<{ photos: SharedPhoto[] }>(r))
      .then((data) => {
        if (active) setPhotos(data.photos);
      })
      .catch((e) => {
        if (active)
          setMessage(
            e instanceof Error ? e.message : 'Unable to load shared evidence.',
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [siteId]);
  const chosen = local.find((p) => p.id === selected);
  return (
    <section className="shared-photo-panel">
      <h3>Shared inspection evidence</h3>
      <p>
        Publish the matching portfolio revision first, then share its photos.
        Shared originals can be opened from another device with access to this
        private Site.
      </p>
      <div className="photo-actions">
        <label>
          Local photo to share
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a saved photo</option>
            {local.map((p) => (
              <option key={p.id} value={p.id}>
                {p.assetId} · {p.filename} · r{p.revision}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || !chosen}
          onClick={async () => {
            if (!chosen) return;
            setBusy(true);
            try {
              const portfolio = await response<{ version: number }>(
                await fetch('/api/portfolio', { cache: 'no-store' }),
              );
              const { bytes, ...metadata } = chosen,
                form = new FormData();
              form.append(
                'metadata',
                JSON.stringify({
                  ...metadata,
                  portfolioVersion: portfolio.version,
                }),
              );
              form.append(
                'file',
                new Blob([bytes], { type: chosen.mime }),
                chosen.filename,
              );
              const saved = await response<SharedPhoto>(
                await fetch(endpoint(siteId), { method: 'POST', body: form }),
              );
              setPhotos((items) => [
                saved,
                ...items.filter((p) => p.id !== saved.id),
              ]);
              setMessage(
                `Photo shared with portfolio v${saved.portfolioVersion}.`,
              );
            } catch (e) {
              setMessage(
                e instanceof Error
                  ? e.message
                  : 'Sharing failed. Local photo is unchanged.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Share selected photo
        </button>
        <button disabled={busy} onClick={refresh}>
          Refresh shared photos
        </button>
      </div>
      {message && <output aria-live="polite">{message}</output>}
      <div className="photo-grid">
        {photos.map((p) => (
          <article key={p.id} className="inspection-photo">
            <a
              href={endpoint(siteId, p.id)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open shared photo ${p.filename}`}
            >
              <img
                src={endpoint(siteId, p.id)}
                alt={`${p.assetId}: ${p.note || p.filename}`}
                loading="lazy"
              />
            </a>
            <strong>{p.filename}</strong>
            <span>
              {p.assetId} · equipment r{p.revision} · portfolio v
              {p.portfolioVersion}
            </span>
            <span>
              {p.source || 'Source unspecified'} ·{' '}
              {p.capturedAt || 'Capture date unspecified'}
            </span>
            {p.note && <p>{p.note}</p>}
            <div className="photo-actions">
              {equipment.some((e) => e.id === p.assetId) && (
                <button onClick={() => onSelect(p.assetId)}>
                  Locate shared component
                </button>
              )}
              <a href={endpoint(siteId, p.id)} download={p.filename}>
                Download shared original
              </a>
              <button disabled={busy} onClick={() => setRemove(p.id)}>
                Remove shared photo
              </button>
            </div>
            <details>
              <summary>Shared provenance</summary>
              <small>SHA-256: {p.sha256}</small>
              <p>
                Saved to shared storage {new Date(p.sharedAt).toLocaleString()}.
                Source notes are user-entered.
              </p>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                      new Blob([JSON.stringify(p, null, 2)], {
                        type: 'application/json',
                      }),
                    ),
                    a = document.createElement('a');
                  a.href = url;
                  a.download = `${p.id}-shared-provenance.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download shared provenance
              </button>
            </details>
            {remove === p.id && (
              <div className="photo-confirm">
                <p>
                  Remove this shared photo for every device? Local copies remain
                  available.
                </p>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await response(
                        await fetch(endpoint(siteId, p.id), {
                          method: 'DELETE',
                        }),
                      );
                      setPhotos((items) =>
                        items.filter((item) => item.id !== p.id),
                      );
                      setRemove('');
                      setMessage('Shared photo removed.');
                    } catch (e) {
                      setMessage(
                        e instanceof Error
                          ? e.message
                          : 'Unable to remove shared photo.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Confirm shared removal
                </button>
                <button onClick={() => setRemove('')}>
                  Cancel shared removal
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!busy && !photos.length && <p>No shared photos for this site.</p>}
      <small>
        Up to 20 shared photos per site. Photos reference saved portfolio
        versions and are separate from JSON and BIM downloads.
      </small>
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { validateSurvey, type SurveyRecord } from '@/lib/survey-store';
import { photoDigest } from '@/lib/photo-store';
import type { SharedSurvey } from '@/lib/shared-surveys';
const endpoint = (site: string, version?: number) =>
  `/api/surveys?site=${encodeURIComponent(site)}${version === undefined ? '' : `&version=${version}`}`;
async function read(response: Response): Promise<SharedSurvey> {
  const raw = await response.json();
  if (!response.ok)
    throw new Error(
      raw &&
        typeof raw === 'object' &&
        'error' in raw &&
        typeof raw.error === 'string'
        ? raw.error
        : 'Shared survey unavailable.',
    );
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('version' in raw) ||
    !Number.isSafeInteger(raw.version) ||
    !('survey' in raw)
  )
    throw new Error('Invalid shared survey response.');
  return raw as SharedSurvey;
}
export default function SharedSurveyPanel({
  siteId,
  local,
  onLoad,
  disabled,
}: {
  siteId: string;
  local: SurveyRecord | null;
  onLoad: (record: SurveyRecord) => Promise<void>;
  disabled: boolean;
}) {
  const [remote, setRemote] = useState<SharedSurvey | null>(null),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState<'open' | 'publish' | 'remove' | null>(
      null,
    );
  useEffect(() => {
    let active = true;
    fetch(endpoint(siteId), { cache: 'no-store' })
      .then(read)
      .then((value) => {
        if (active) setRemote(value);
      })
      .catch((e) => {
        if (active)
          setMessage(
            e instanceof Error ? e.message : 'Unable to read shared survey.',
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [siteId]);
  const refresh = async () => {
    setBusy(true);
    try {
      setRemote(
        await read(await fetch(endpoint(siteId), { cache: 'no-store' })),
      );
      setConfirm(null);
      setMessage('Shared survey status refreshed.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to refresh.');
    } finally {
      setBusy(false);
    }
  };
  const act = async (action: 'open' | 'publish' | 'remove') => {
    if (!remote) return;
    setBusy(true);
    setConfirm(null);
    try {
      if (action === 'open') {
        if (!remote.survey) return;
        const response = await fetch(
          endpoint(siteId, remote.version) + '&file=1',
          { cache: 'no-store' },
        );
        if (!response.ok) {
          await read(response);
          return;
        }
        const record: SurveyRecord = {
          ...remote.survey,
          bytes: await response.arrayBuffer(),
        };
        validateSurvey(record);
        if ((await photoDigest(record.bytes)) !== record.sha256)
          throw new Error('Downloaded survey failed its integrity check.');
        await onLoad(record);
        setMessage(
          `Shared survey v${remote.version} opened with its saved alignment.`,
        );
      } else if (action === 'publish') {
        if (!local) return;
        const { bytes, ...metadata } = local,
          response = await fetch(endpoint(siteId, remote.version), {
            method: 'PUT',
            headers: {
              'Content-Type': 'model/gltf-binary',
              'X-Citymesh-Survey': encodeURIComponent(JSON.stringify(metadata)),
            },
            body: bytes,
          });
        if (response.status === 409) setRemote(null);
        const next = await read(response);
        setRemote(next);
        setMessage(`Survey and alignment shared as v${next.version}.`);
      } else {
        const response = await fetch(endpoint(siteId, remote.version), {
          method: 'DELETE',
        });
        if (response.status === 409) setRemote(null);
        setRemote(await read(response));
        setMessage('Shared survey removed. Local copies are unchanged.');
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Shared survey action failed.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="shared-survey">
      <h3>Shared survey model</h3>
      <p>
        Share the current model and alignment for access from another device.
        Replacing the shared copy keeps its version counter; download the
        previous original and provenance if you need an archive.
      </p>
      {remote?.survey ? (
        <div className="survey-record">
          <strong>
            {remote.survey.filename} · shared v{remote.version}
          </strong>
          <span>
            {remote.survey.source || 'Source unspecified'} ·{' '}
            {remote.survey.capturedAt || 'Capture date unspecified'} ·{' '}
            {(remote.survey.byteLength / 1024 / 1024).toFixed(2)} MB
          </span>
          <small>SHA-256: {remote.survey.sha256}</small>
          {remote.survey.note && <p>{remote.survey.note}</p>}
          <div className="survey-actions">
            <a
              href={endpoint(siteId, remote.version) + '&file=1'}
              download={remote.survey.filename}
            >
              Download shared GLB
            </a>
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                    new Blob([JSON.stringify(remote, null, 2)], {
                      type: 'application/json',
                    }),
                  ),
                  a = document.createElement('a');
                a.href = url;
                a.download = `${siteId}-shared-survey-v${remote.version}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download shared survey provenance
            </button>
          </div>
        </div>
      ) : (
        remote && <p>No shared survey for this site.</p>
      )}
      <div className="survey-actions">
        <button disabled={busy || disabled} onClick={refresh}>
          Refresh shared survey
        </button>
        <button
          disabled={busy || disabled || !remote || !local}
          onClick={() =>
            remote?.survey ? setConfirm('publish') : act('publish')
          }
        >
          Share current model & alignment
        </button>
        <button
          disabled={busy || disabled || !remote?.survey}
          onClick={() => (local ? setConfirm('open') : act('open'))}
        >
          Open shared survey
        </button>
        <button
          disabled={busy || disabled || !remote?.survey}
          onClick={() => setConfirm('remove')}
        >
          Remove shared survey
        </button>
      </div>
      {confirm && (
        <div className="survey-remove">
          <p>
            {confirm === 'open'
              ? 'Replace this browser’s survey with the shared model and alignment? Download your current GLB first if needed.'
              : confirm === 'publish'
                ? 'Replace the shared survey and alignment for every device?'
                : 'Remove the shared survey for every device? Local copies remain available.'}
          </p>
          <button disabled={busy || disabled} onClick={() => act(confirm)}>
            Confirm shared survey {confirm}
          </button>
          <button onClick={() => setConfirm(null)}>
            Cancel shared survey action
          </button>
        </div>
      )}
      {message && <output aria-live="polite">{message}</output>}
      <small>
        Private site storage. Alignment is manually supplied and does not
        establish surveyed accuracy. Imported geometry is validated again before
        it opens in the 3D viewer.
      </small>
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from './site-link';
import { networkLinks } from '@/lib/private-network';
import { freshObservation, type Observation } from '@/lib/observations';
import './observations.css';
async function response(r: Response) {
  const data = (await r.json()) as Record<string, unknown>;
  if (!r.ok)
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Observation service unavailable.',
    );
  return data;
}
export default function ObservationsPanel({
  enabled,
  onEnabled,
  onData,
}: {
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  onData: (records: Observation[], now: number) => void;
}) {
  const [records, setRecords] = useState<Observation[]>([]),
    [now, setNow] = useState(() => Date.now()),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [checked, setChecked] = useState('');
  useEffect(() => {
    let active = true,
      inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await response(
          await fetch('/api/observations', { cache: 'no-store' }),
        );
        if (
          !Array.isArray(data.observations) ||
          typeof data.serverTime !== 'string' ||
          !Number.isFinite(Date.parse(data.serverTime))
        )
          throw new Error('Invalid observation response.');
        if (active) {
          setRecords(data.observations as Observation[]);
          setOffset(Date.parse(data.serverTime) - Date.now());
          setChecked(data.serverTime);
        }
      } catch (e) {
        if (active)
          setMessage(
            e instanceof Error ? e.message : 'Unable to refresh observations.',
          );
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const interval = setInterval(() => {
      setNow(Date.now());
      void poll();
    }, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  const clock = now + offset,
    fresh = records.filter((r) => freshObservation(r, clock));
  useEffect(() => {
    onData(
      records.filter((r) => freshObservation(r, now + offset)),
      now + offset,
    );
  }, [records, now, offset, onData]);
  const download = () => {
    const template = {
      schema: 1,
      source: 'Replace with monitoring system name',
      observations: [
        {
          kind: 'equipment',
          siteId: 'GBT-01',
          assetId: 'RRU-A',
          observedAt: new Date().toISOString(),
          state: 'unknown',
        },
        {
          kind: 'link',
          linkId: 'L02',
          observedAt: new Date().toISOString(),
          state: 'unknown',
        },
      ],
    };
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(template, null, 2)], {
          type: 'application/json',
        }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = 'citymesh-observation-format.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="observations-panel">
      <header>
        <div>
          <small>OPERATE / REPORTED OBSERVATIONS</small>
          <h2>Measurements linked to physical assets</h2>
          <p>
            {records.length} reported entities · {fresh.length} fresh ·{' '}
            {records.length - fresh.length} stale or future-dated
          </p>
        </div>
        <label className="observation-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabled(e.target.checked)}
          />{' '}
          Apply fresh reported faults to routing
        </label>
      </header>
      <p>
        Imported observations are separate from simulation values and saved
        equipment conditions. No monitoring system is connected automatically.
        Reports expire from the routing input after five minutes.
      </p>
      <div className="observation-actions">
        <label>
          Import observation JSON
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Import network observations"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                if (file.size > 512000)
                  throw new Error('Observation batch exceeds 500 KB.');
                const data = await response(
                  await fetch('/api/observations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: await file.text(),
                  }),
                );
                setMessage(
                  `Accepted ${Number(data.accepted)} observations; ignored ${Number(data.ignored)} older or equal timestamps.`,
                );
                const current = await response(
                  await fetch('/api/observations', { cache: 'no-store' }),
                );
                setRecords(current.observations as Observation[]);
                setChecked(String(current.serverTime));
                setNow(Date.now());
                setOffset(Date.parse(String(current.serverTime)) - Date.now());
              } catch (e) {
                setMessage(
                  e instanceof Error
                    ? e.message
                    : 'Unable to import observations.',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <button onClick={download}>Download format example</button>
        <span>
          {checked
            ? `Last checked ${new Date(checked).toLocaleTimeString()}`
            : 'Connecting to observation storage…'}
        </span>
      </div>
      {message && <output aria-live="polite">{message}</output>}
      <details>
        <summary>Data contract and routing behavior</summary>
        <p>
          Source names are supplied by the uploader. Use UTC ISO timestamps and
          equipment IDs from the shared portfolio. Each batch contains 1–500
          equipment or link observations. Optional measurements: temperatureC
          (°C), rxPowerDbm (dBm), throughputMbps (Mbps). Unknown is a supported
          state; missing measurements are shown as unavailable.
        </p>
        <p>
          When enabled, fresh down equipment becomes an overlay fault and fresh
          down links are excluded. Degraded equipment uses the existing warning
          model. Up reports do not clear saved or manual faults. Degraded links
          retain modeled capacity because no measured capacity reduction is
          specified. Receiving data does not certify sensor accuracy.
        </p>
        <p>
          POST /api/observations accepts schema-1 JSON through the Site’s
          authenticated session with a same-origin request. No unauthenticated
          collector endpoint is exposed. Polling checks for new reports every 15
          seconds.
        </p>
      </details>
      <div className="observation-table">
        <table>
          <thead>
            <tr>
              <th>Physical target</th>
              <th>Reported state</th>
              <th>Temperature</th>
              <th>RX power</th>
              <th>Throughput</th>
              <th>Source / observed time</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.key}>
                <td>
                  {r.kind === 'equipment' ? (
                    <Link
                      href={`/sites?site=${r.siteId}&asset=${encodeURIComponent(r.assetId)}`}
                    >
                      {r.siteId} / {r.assetId}
                    </Link>
                  ) : (
                    <Link href={`/?link=${r.linkId}`}>
                      {r.linkId} transport
                    </Link>
                  )}
                </td>
                <td>
                  <b>{r.state}</b> ·{' '}
                  {freshObservation(r, clock) ? 'Fresh' : 'Not fresh'}
                  {(r.state === 'down' || r.state === 'degraded') && (
                    <>
                      <br />
                      <Link
                        href={`/sites?site=${r.kind === 'equipment' ? r.siteId : networkLinks.find((l) => l.id === r.linkId)?.a || ''}&phase=operate${r.kind === 'equipment' ? `&asset=${encodeURIComponent(r.assetId)}` : ''}`}
                      >
                        Review reported fault
                      </Link>
                    </>
                  )}
                </td>
                <td>
                  {r.temperatureC === undefined ? '—' : `${r.temperatureC} °C`}
                </td>
                <td>
                  {r.rxPowerDbm === undefined ? '—' : `${r.rxPowerDbm} dBm`}
                </td>
                <td>
                  {r.throughputMbps === undefined
                    ? '—'
                    : `${r.throughputMbps} Mbps`}
                </td>
                <td>
                  {r.source}
                  <br />
                  {new Date(r.observedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!records.length && (
        <p>
          No observations received. Import reports from your monitoring export
          to populate this view.
        </p>
      )}
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import type { Project } from '@/lib/site-model';
import { freshObservation, type Observation } from '@/lib/observations';
import {
  observationTarget,
  existingObservationIssue,
  issueFromObservation,
} from '@/lib/observation-issues';
import './reported-faults.css';
export default function ReportedFaults({
  project,
  onUpdate,
  onSelect,
}: {
  project: Project;
  onUpdate: (project: Project) => void;
  onSelect: (id: string) => void;
}) {
  const [records, setRecords] = useState<Observation[]>([]),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState(''),
    [clock, setClock] = useState(0);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch('/api/observations', {
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error('Reported faults could not be loaded.');
        const data = (await response.json()) as {
          observations: Observation[];
          serverTime: string;
        };
        if (
          !Array.isArray(data.observations) ||
          !Number.isFinite(Date.parse(data.serverTime))
        )
          throw new Error('Invalid observation response.');
        if (active) {
          setRecords(data.observations);
          setClock(Date.parse(data.serverTime));
        }
      } catch (e) {
        if (active)
          setMessage(
            e instanceof Error ? e.message : 'Observation service unavailable.',
          );
      } finally {
        if (active) setBusy(false);
      }
    };
    void poll();
    const interval = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  const reports = records.filter(
    (r) =>
      (r.state === 'down' || r.state === 'degraded') &&
      observationTarget(project, r),
  );
  return (
    <section className="reported-faults">
      <h3>Reported faults at this site</h3>
      <p>
        Review equipment and connected-link reports, then record a maintenance
        issue. Reports refresh every 15 seconds. Issues remain local until you
        publish the portfolio.
      </p>
      {busy && <p>Loading reports…</p>}
      {!busy && !reports.length && (
        <p>No down or degraded reports map to this site.</p>
      )}
      {reports.map((r) => {
        const target = observationTarget(project, r)!,
          existing = existingObservationIssue(project, r);
        return (
          <article key={r.key}>
            <strong>
              {target.label} · {r.state}
            </strong>
            <small>
              {r.source} · {new Date(r.observedAt).toLocaleString()} ·{' '}
              {freshObservation(r, clock)
                ? 'Fresh at last check'
                : 'Stale or future-dated; verify before acting'}
            </small>
            <div>
              {target.assetId !== 'site' && (
                <button onClick={() => onSelect(target.assetId)}>
                  Locate reported equipment
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  try {
                    const result = issueFromObservation(project, r);
                    if (result.created) onUpdate(result.project);
                    if (result.issue.assetId !== 'site')
                      onSelect(result.issue.assetId);
                    setMessage(
                      result.created
                        ? 'Maintenance issue created with the report snapshot. Review it in Site issues below.'
                        : `An ${result.issue.status} issue already references this report. See Site issues below.`,
                    );
                  } catch (e) {
                    setMessage(
                      e instanceof Error
                        ? e.message
                        : 'Unable to record maintenance issue.',
                    );
                  }
                }}
              >
                {existing
                  ? `Issue already ${existing.status}`
                  : 'Create maintenance issue'}
              </button>
            </div>
            {existing && (
              <small>
                {existing.title} · {existing.status}
              </small>
            )}
          </article>
        );
      })}
      {message && <output aria-live="polite">{message}</output>}
      <small>
        Issue creation does not acknowledge or clear the source alarm. Repeated
        reports reuse an open issue; a later recurrence can create a new issue
        after resolution.
      </small>
    </section>
  );
}

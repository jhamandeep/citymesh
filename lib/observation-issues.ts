import { networkLinks } from './private-network.ts';
import { parseProject, type Project, type Issue } from './site-model.ts';
import type { Observation } from './observations.ts';
export function observationTarget(project: Project, report: Observation) {
  if (report.kind === 'equipment') {
    const asset = project.equipment.find((e) => e.id === report.assetId);
    return report.siteId === project.siteId && asset
      ? { assetId: asset.id, label: asset.name }
      : null;
  }
  const link = networkLinks.find(
    (l) =>
      l.id === report.linkId &&
      (l.a === project.siteId || l.b === project.siteId),
  );
  if (!link) return null;
  const port = link.a === project.siteId ? link.aPort : link.bPort,
    assetId = port.split('/')[1];
  return {
    assetId: project.equipment.some((e) => e.id === assetId) ? assetId : 'site',
    label: `${link.id} · ${port}`,
  };
}
export function existingObservationIssue(
  project: Project,
  report: Observation,
) {
  return project.issues.find(
    (i) =>
      i.observation?.key === report.key &&
      (i.status === 'open' || i.observation.observedAt === report.observedAt),
  );
}
export function issueFromObservation(
  project: Project,
  report: Observation,
  now = Date.now(),
): { project: Project; issue: Issue; created: boolean } {
  const target = observationTarget(project, report);
  if (!target)
    throw new Error('This report does not map to the current site inventory.');
  if (report.state !== 'down' && report.state !== 'degraded')
    throw new Error('Only down or degraded reports can open a fault issue.');
  const prior = existingObservationIssue(project, report);
  if (prior) return { project, issue: prior, created: false };
  if (project.issues.length >= 300)
    throw new Error('This project has reached its 300-issue limit.');
  const createdAt = new Date(now).toISOString(),
    measurements = [
      report.temperatureC === undefined
        ? ''
        : `Temperature: ${report.temperatureC} °C`,
      report.rxPowerDbm === undefined
        ? ''
        : `RX power: ${report.rxPowerDbm} dBm`,
      report.throughputMbps === undefined
        ? ''
        : `Throughput: ${report.throughputMbps} Mbps`,
    ].filter(Boolean);
  const issue: Issue = {
    id: crypto.randomUUID(),
    assetId: target.assetId,
    title: `Reported ${report.state}: ${report.kind === 'link' ? report.linkId : report.assetId}`,
    severity: report.state === 'down' ? 'high' : 'medium',
    status: 'open',
    createdAt,
    note: [
      `Source: ${report.source}`,
      `Observed: ${report.observedAt}`,
      `Target: ${target.label}`,
      `Reported state: ${report.state}`,
      ...measurements,
      'Imported report; verify on site. Creating this issue does not change equipment condition.',
    ].join('\n'),
    observation: {
      key: report.key,
      observedAt: report.observedAt,
      source: report.source,
      state: report.state,
    },
  };
  return {
    project: parseProject({
      ...project,
      issues: [issue, ...project.issues],
      history: [
        {
          at: createdAt,
          event: `Issue opened from ${report.source}: ${issue.title}`,
        },
        ...project.history,
      ].slice(0, 100),
    }),
    issue,
    created: true,
  };
}

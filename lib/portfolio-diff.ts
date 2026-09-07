import type { Project } from './site-model.ts';
export function comparePortfolios(
  current: Record<string, Project>,
  next: Record<string, Project>,
) {
  return Object.values(next).map((p) => {
    const before = current[p.siteId];
    return {
      siteId: p.siteId,
      changed: JSON.stringify(before) !== JSON.stringify(p),
      beforeAssets: before.equipment.length,
      afterAssets: p.equipment.length,
      otherChanges: (
        [
          'name',
          'revision',
          'baseline',
          'issues',
          'work',
          'history',
          'survey',
        ] as const
      ).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(p[key])),
      beforeStage: before.stage,
      afterStage: p.stage,
      added: p.equipment.filter(
        (e) => !before.equipment.some((b) => b.id === e.id),
      ).length,
      removed: before.equipment.filter(
        (e) => !p.equipment.some((b) => b.id === e.id),
      ).length,
      modified: p.equipment.filter((e) => {
        const b = before.equipment.find((b) => b.id === e.id);
        return b && JSON.stringify(b) !== JSON.stringify(e);
      }).length,
    };
  });
}

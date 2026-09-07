export type SiteType = 'GBT' | 'RTT' | 'IBS' | 'SMALL_CELL' | 'CORE';
export type SiteDefinition = {
  id: string;
  name: string;
  type: SiteType;
  zone: string;
  x: number;
  y: number;
  height: number;
  powerLimit: number;
  demand: number;
  address: string;
};
const names = {
  GBT: [
    'North perimeter',
    'Logistics yard',
    'West utility corridor',
    'Manufacturing east',
    'South perimeter',
    'Water services',
    'Warehouse district',
    'Transit corridor',
  ],
  RTT: [
    'Administration rooftop',
    'Engineering rooftop',
    'Security command rooftop',
    'Research block rooftop',
    'Operations rooftop',
    'Training centre rooftop',
    'Hospital rooftop',
    'Dispatch rooftop',
  ],
  IBS: [
    'Assembly hall',
    'Distribution centre',
    'Administrative block',
    'Research laboratories',
    'Medical centre',
    'Training academy',
    'Data services building',
    'Control centre',
    'Workshop complex',
    'Logistics terminal',
  ],
  SMALL_CELL: ['Main gate plaza', 'Staff transit hub'],
  CORE: ['Primary network core', 'Disaster recovery core'],
};
const coords: Record<SiteType, [number, number][]> = {
  CORE: [
    [430, 290],
    [650, 460],
  ],
  GBT: [
    [150, 110],
    [390, 90],
    [90, 300],
    [755, 100],
    [220, 570],
    [770, 570],
    [870, 270],
    [440, 610],
  ],
  RTT: [
    [260, 175],
    [535, 115],
    [165, 405],
    [690, 200],
    [525, 535],
    [355, 420],
    [810, 420],
    [900, 560],
  ],
  IBS: [
    [280, 270],
    [510, 205],
    [360, 330],
    [620, 80],
    [590, 345],
    [280, 495],
    [735, 320],
    [440, 470],
    [100, 520],
    [870, 155],
  ],
  SMALL_CELL: [
    [80, 175],
    [630, 600],
  ],
};
export const siteDefinitions: SiteDefinition[] = (
  ['CORE', 'GBT', 'RTT', 'IBS', 'SMALL_CELL'] as SiteType[]
).flatMap((type) =>
  names[type].map((name, i) => {
    const [x, y] = coords[type][i];
    const id = `${type === 'SMALL_CELL' ? 'SC' : type}-${String(i + 1).padStart(2, '0')}`;
    return {
      id,
      name,
      type,
      x,
      y,
      zone:
        y < 220
          ? 'North campus'
          : y > 450
            ? 'South campus'
            : x < 400
              ? 'West campus'
              : 'Central campus',
      height:
        type === 'GBT'
          ? 24
          : type === 'RTT'
            ? 20
            : type === 'IBS'
              ? 12
              : type === 'SMALL_CELL'
                ? 10
                : 4,
      powerLimit: type === 'CORE' ? 12000 : type === 'IBS' ? 5000 : 3000,
      demand:
        type === 'CORE'
          ? 0
          : type === 'IBS'
            ? 120 + i * 12
            : type === 'SMALL_CELL'
              ? 90
              : type === 'GBT'
                ? 220 + i * 10
                : 180 + i * 10,
      address: `Private campus / ${id} / Austin, Texas hypothetical site`,
    };
  }),
);
export const siteById = (id: string) =>
  siteDefinitions.find((s) => s.id === id);
export const canonicalSiteId = (id: string) =>
  id === 'north' ? 'GBT-01' : id === 'south' ? 'GBT-05' : id;
export type Backhaul = {
  id: string;
  a: string;
  b: string;
  kind: 'fiber' | 'microwave' | 'ethernet';
  capacity: number;
  latency: number;
  aPort: string;
  bPort: string;
  vlan: number;
};
const backhaul: Backhaul[] = [];
function link(
  a: string,
  b: string,
  kind: Backhaul['kind'],
  capacity: number,
  latency: number,
) {
  const index = backhaul.length + 1;
  backhaul.push({
    id: `L${String(index).padStart(2, '0')}`,
    a,
    b,
    kind,
    capacity,
    latency,
    aPort: `${a}/${a.startsWith('CORE') ? 'GW-A' : 'CAB-01'}/port-${index}`,
    bPort: `${b}/${b.startsWith('CORE') ? 'GW-A' : 'CAB-01'}/port-${index}`,
    vlan: 200 + Math.floor(index / 8),
  });
}
link('CORE-01', 'CORE-02', 'fiber', 10000, 1);
const ring = [
  'CORE-01',
  'GBT-01',
  'GBT-02',
  'GBT-04',
  'GBT-07',
  'CORE-02',
  'GBT-06',
  'GBT-08',
  'GBT-05',
  'GBT-03',
  'CORE-01',
];
for (let i = 0; i < ring.length - 1; i++)
  link(ring[i], ring[i + 1], 'fiber', 2500, 2);
for (let i = 1; i <= 8; i++) {
  const id = `RTT-${String(i).padStart(2, '0')}`,
    parent = `GBT-${String(i).padStart(2, '0')}`;
  link(
    parent,
    id,
    i % 3 === 0 ? 'microwave' : 'fiber',
    i % 3 === 0 ? 600 : 1000,
    i % 3 === 0 ? 5 : 2,
  );
  if (i % 2 === 0)
    link(i <= 4 ? 'CORE-01' : 'CORE-02', id, 'microwave', 500, 6);
}
for (let i = 1; i <= 10; i++) {
  const id = `IBS-${String(i).padStart(2, '0')}`,
    parent = `RTT-${String(((i - 1) % 8) + 1).padStart(2, '0')}`;
  link(parent, id, 'ethernet', 1000, 1);
  if (i === 3 || i === 5 || i === 8) link('CORE-02', id, 'fiber', 1000, 2);
}
link('GBT-03', 'SC-01', 'microwave', 300, 5);
link('GBT-08', 'SC-02', 'fiber', 500, 2);
// All seven proposed microwave paths failed the sourced Austin LoS assessment.
export const fiberReplacements = backhaul
  .filter((l) => l.kind === 'microwave')
  .map((l) => l.id);
export const networkLinks: Backhaul[] = backhaul.map((l) =>
  l.kind === 'microwave'
    ? { ...l, kind: 'fiber', capacity: 1000, latency: 2 }
    : l,
);
export type NetworkScenario = 'normal' | 'fiber' | 'power' | 'core' | 'peak';
export const networkScenarios = [
  {
    id: 'normal',
    name: 'Normal operations',
    description: 'Both private cores and all transport paths available.',
  },
  {
    id: 'fiber',
    name: 'Fiber ring cut',
    description:
      'Break the primary core-to-north ring link. Reachable sites route through an alternate path.',
  },
  {
    id: 'power',
    name: 'North campus outage',
    description:
      'Disconnect non-core sites in North campus to model exhausted backup power.',
  },
  {
    id: 'core',
    name: 'Primary core failure',
    description:
      'Take CORE-01 offline. The disaster recovery core becomes the source for remaining sites.',
  },
  {
    id: 'peak',
    name: 'Campus demand surge',
    description:
      'Double all site demand. Shared transport links can become congested.',
  },
] as const;
export function simulateNetwork(
  scenario: NetworkScenario,
  demand: number,
  failedSites: string[] = [],
  failedLinks: string[] = [],
  radioFactors: Record<string, number> = {},
) {
  const failed = new Set(failedSites);
  if (scenario === 'power')
    siteDefinitions
      .filter((s) => s.zone === 'North campus' && s.type !== 'CORE')
      .forEach((s) => failed.add(s.id));
  if (scenario === 'core') failed.add('CORE-01');
  const broken = networkLinks.map(
    (l) =>
      failed.has(l.a) ||
      failed.has(l.b) ||
      failedLinks.includes(l.id) ||
      (scenario === 'fiber' && l.id === 'L02'),
  );
  const distance: Record<string, number> = {},
    routes: Record<string, number[]> = {},
    sources: Record<string, string> = {};
  for (const s of siteDefinitions) distance[s.id] = Infinity;
  for (const core of ['CORE-01', 'CORE-02'])
    if (!failed.has(core)) {
      distance[core] = 0;
      routes[core] = [];
      sources[core] = core;
    }
  const visited = new Set<string>();
  for (let n = 0; n < siteDefinitions.length; n++) {
    const current = siteDefinitions
      .filter((s) => !visited.has(s.id))
      .sort((a, b) => distance[a.id] - distance[b.id])[0];
    if (!current || !Number.isFinite(distance[current.id])) break;
    visited.add(current.id);
    networkLinks.forEach((l, i) => {
      if (broken[i]) return;
      const next = l.a === current.id ? l.b : l.b === current.id ? l.a : null;
      if (!next) return;
      const cost = distance[current.id] + l.latency;
      if (cost < distance[next]) {
        distance[next] = cost;
        routes[next] = [...routes[current.id], i];
        sources[next] = sources[current.id];
      }
    });
  }
  const multiplier = (demand / 100) * (scenario === 'peak' ? 2 : 1),
    loads = networkLinks.map(() => 0);
  for (const s of siteDefinitions)
    routes[s.id]?.forEach((i) => (loads[i] += s.demand * multiplier));
  const states = siteDefinitions.map((s) => {
    const route = routes[s.id],
      requested = s.demand * multiplier;
    const factor = Math.max(0, Math.min(1, radioFactors[s.id] ?? 1));
    const fraction = route
      ? Math.min(
          factor,
          1,
          ...route.map((i) => networkLinks[i].capacity / Math.max(1, loads[i])),
        )
      : 0;
    return {
      ...s,
      status: !route ? 'offline' : fraction < 0.999 ? 'degraded' : 'online',
      route,
      source: sources[s.id],
      requested,
      delivered: requested * fraction,
      latency: route ? distance[s.id] + 2 + (1 - fraction) * 50 : 0,
    };
  });
  const served = states.filter(
    (s) => s.status !== 'offline' && s.type !== 'CORE',
  );
  return {
    states,
    loads,
    broken,
    online: states.filter((s) => s.status !== 'offline').length,
    delivered: states.reduce((n, s) => n + s.delivered, 0),
    requested: states.reduce((n, s) => n + s.requested, 0),
    latency:
      served.reduce((n, s) => n + s.latency, 0) / Math.max(1, served.length),
  };
}

import { networkLinks, siteById, type Backhaul } from './private-network.ts';
import type { Equipment, Project } from './site-model.ts';
export type CableMedium =
  | 'fiber'
  | 'ethernet'
  | 'rf'
  | 'dc'
  | 'ground'
  | 'microwave';
export type CableEndpoint = {
  siteId: string;
  assetId: string;
  assetName: string;
  port: string;
  connector: string;
  position: [number, number, number];
};
export type PhysicalCable = {
  id: string;
  label: string;
  medium: CableMedium;
  role: string;
  from: CableEndpoint;
  to: CableEndpoint;
  cable: string;
  length: number;
  lengthBasis: string;
  service: string;
  details: string;
  networkLink?: string;
};
export type CablePlan = { devices: Equipment[]; cables: PhysicalCable[] };
export const cableColors: Record<CableMedium, string> = {
  fiber: '#48c8ba',
  ethernet: '#65a4ee',
  rf: '#edbe6b',
  dc: '#ed7e82',
  ground: '#90b56a',
  microwave: '#b495ee',
};
export const cableLabels: Record<CableMedium, string> = {
  fiber: 'Fiber / optical patch',
  ethernet: 'Ethernet / copper',
  rf: 'RF jumper / coax',
  dc: 'DC power',
  ground: 'Grounding',
  microwave: 'Microwave path',
};
const rounded = (n: number) => Math.round(n * 10) / 10;
export function equipmentEndpoint(
  p: Project,
  e: Equipment,
  port: string,
  connector: string,
): CableEndpoint {
  if (e.id.startsWith('W-MW-'))
    return {
      siteId: p.siteId,
      assetId: e.id,
      assetName: e.name,
      port,
      connector,
      position:
        port === 'RF path'
          ? [...e.position]
          : [e.position[0], e.position[1] - 0.45, e.position[2]],
    };
  const angle = (-e.azimuth * Math.PI) / 180,
    offset = (e.size[2] / 2 + 0.08) * (port.startsWith('Rear-') ? -1 : 1);
  return {
    siteId: p.siteId,
    assetId: e.id,
    assetName: e.name,
    port,
    connector,
    position: [
      e.position[0] + Math.sin(angle) * offset,
      e.position[1],
      e.position[2] + Math.cos(angle) * offset,
    ],
  };
}
function ancillary(
  p: Project,
  id: string,
  name: string,
  kind: Equipment['kind'],
  position: Equipment['position'],
  size: Equipment['size'],
): Equipment {
  return {
    id,
    name,
    kind,
    position,
    size,
    azimuth: 0,
    vendor: 'Demonstration wiring plan',
    model: name,
    serial: 'Virtual wiring fixture',
    power: 0,
    weight: 0,
    logicalId: `${p.siteId}/${id}`,
    condition: 'healthy',
  };
}
function distance(a: CableEndpoint, b: CableEndpoint) {
  return rounded(
    Math.abs(a.position[0] - b.position[0]) +
      Math.abs(a.position[1] - b.position[1]) +
      Math.abs(a.position[2] - b.position[2]) +
      1,
  );
}
export function buildSiteCabling(p: Project): CablePlan {
  const definition = siteById(p.siteId)!;
  const gateway =
    p.equipment.find(
      (e) => e.id.startsWith('GW-') && e.condition !== 'offline',
    ) ||
    p.equipment.find((e) => e.id === 'GW-A') ||
    p.equipment.find((e) => e.kind === 'cabinet');
  if (!gateway) return { devices: [], cables: [] };
  const height = definition.type === 'RTT' ? 12 : 0;
  const odf = ancillary(
    p,
    'W-ODF',
    'Optical distribution frame',
    'cabinet',
    [gateway.position[0] - 1.8, height + 1.3, gateway.position[2]],
    [0.65, 1.7, 0.35],
  );
  const pdu = ancillary(
    p,
    'W-PDU',
    '48 V DC distribution',
    'cabinet',
    [gateway.position[0] + 1.3, height + 0.75, gateway.position[2]],
    [0.45, 0.7, 0.3],
  );
  const earth = ancillary(
    p,
    'W-EARTH',
    'Site earth bar',
    'cabinet',
    [gateway.position[0] + 1.1, height + 0.25, gateway.position[2] + 0.8],
    [0.5, 0.08, 0.1],
  );
  const devices = [odf, pdu, earth],
    cables: PhysicalCable[] = [];
  const endpoint = (e: Equipment, port: string, connector: string) =>
    equipmentEndpoint(p, e, port, connector);
  const add = (
    id: string,
    label: string,
    medium: CableMedium,
    from: CableEndpoint,
    to: CableEndpoint,
    cable: string,
    service: string,
    details: string,
    role = 'cable',
    networkLink?: string,
  ) => {
    cables.push({
      id: `${p.siteId}/${id}`,
      label,
      medium,
      role,
      from,
      to,
      cable,
      service,
      details,
      networkLink,
      length: distance(from, to),
      lengthBasis:
        'Schematic routing estimate, including 1 m service allowance',
    });
  };
  for (const l of networkLinks.filter(
    (l) => l.a === p.siteId || l.b === p.siteId,
  )) {
    if (l.kind === 'microwave') {
      const radio = ancillary(
        p,
        `W-MW-${l.id}`,
        `${l.id} parabolic dish + outdoor radio`,
        'radio',
        [
          2,
          Math.max(3, definition.height - 2),
          2 + Number(l.id.slice(1)) * 0.1,
        ],
        [1.2, 1.2, 1],
      );
      devices.push(radio);
      add(
        `ETH-${l.id}`,
        `${l.id} IDU to outdoor radio`,
        'ethernet',
        endpoint(gateway, `GE-${l.id}`, 'RJ45'),
        endpoint(radio, 'GE/PoE', 'RJ45 weatherproof'),
        'Shielded Cat6A',
        'Ethernet transport / PoE',
        'Weatherproof boot at outdoor unit; drip loop at entry. Shield bonding and PoE ratings require actual hardware verification.',
        'backhaul patch',
        l.id,
      );
    } else {
      add(
        `PATCH-${l.id}`,
        `${l.id} equipment-to-ODF patch`,
        'fiber',
        endpoint(gateway, `SFP-${l.id}`, 'LC/UPC duplex'),
        endpoint(odf, `Front-${l.id}:1/2`, 'LC/UPC duplex'),
        'OS2 duplex optical patch lead',
        l.kind === 'ethernet'
          ? '1 GbE over fiber'
          : 'Optical Ethernet backhaul',
        'Tx connects to remote Rx; two strands per duplex circuit. Demonstration 1310 nm optic, provisioned bandwidth shown in transport details.',
        'backhaul patch',
        l.id,
      );
      add(
        `SPLICE-${l.id}`,
        `${l.id} ODF pigtail / splice`,
        'fiber',
        endpoint(odf, `Rear-${l.id}:1/2`, 'LC adapter'),
        endpoint(odf, `Tray-${l.id}:1/2`, 'Fusion splice'),
        'OS2 LC pigtails to cable strands 1/2',
        'Passive optical continuity',
        'Front LC pair → pigtails → labeled fusion-splice tray → trunk strands 1/2. Remaining trunk strands are spare.',
        'splice',
        l.id,
      );
    }
  }
  const coreSwitch = p.equipment.find((e) => e.id === 'SW-01'),
    upf = p.equipment.find((e) => e.id === 'UPF-01');
  if (coreSwitch) {
    if (upf)
      add(
        'CORE-LAN',
        'UPF to transport switch',
        'ethernet',
        endpoint(upf, 'N3/eth0', 'RJ45'),
        endpoint(coreSwitch, 'Access-01', 'RJ45'),
        'Cat6A patch cord',
        'Private 5G user plane',
        'Demonstration N3 user-plane connectivity. IP addresses and actual switch configuration are not provisioned.',
      );
    add(
      'CORE-GW',
      'Switch to gateway',
      'fiber',
      endpoint(coreSwitch, 'SFP-Uplink-A', 'LC/UPC duplex'),
      endpoint(gateway, 'SFP-LAN', 'LC/UPC duplex'),
      'OS2 duplex patch lead',
      'Core LAN uplink',
      'Cross-connect Tx/Rx; label both ends with the equipment and port identifiers.',
    );
  }
  const radios = p.equipment.filter((e) => e.kind === 'radio');
  const antennas = p.equipment.filter((e) => e.kind === 'antenna');
  radios.forEach((r) => {
    add(
      `RU-FIBER-${r.id}`,
      `${r.name} optical fronthaul`,
      'fiber',
      endpoint(gateway, `FH-${r.id}`, 'LC/UPC duplex'),
      endpoint(r, 'OPT-1', 'LC/UPC weatherproof'),
      'OS2 duplex fiber feeder',
      definition.type === 'IBS'
        ? 'DAS digital optical link'
        : 'CPRI / eCPRI demonstration',
      'Optical Tx/Rx pair terminates at the radio optical port. Route on the cable ladder with service loops; protocol and optics depend on selected hardware.',
    );
    const served =
      definition.type === 'IBS'
        ? antennas.filter((a) =>
            a.id.startsWith(`DAS-${r.id.replace('RU-', '')}-`),
          )
        : antennas.filter((a) => a.id === r.id.replace('RRU-', 'ANT-'));
    if (definition.type === 'IBS' && served.length) {
      const split = ancillary(
        p,
        `W-SPLIT-${r.id}`,
        `${r.name} two-way splitter`,
        'radio',
        [0, r.position[1] + 0.6, -1],
        [0.25, 0.15, 0.2],
      );
      devices.push(split);
      add(
        `RF-SPLIT-${r.id}`,
        'Remote unit to floor splitter',
        'rf',
        endpoint(r, 'RF-OUT', 'N female'),
        endpoint(split, 'IN', 'N female'),
        '50 Ω coaxial RF jumper',
        'DAS RF distribution',
        'N male jumper ends mate to female RF ports. A passive two-way splitter feeds this floor’s two antennas.',
      );
      served.forEach((a, i) =>
        add(
          `RF-${a.id}`,
          `${a.name} coax feeder`,
          'rf',
          endpoint(split, `OUT-${i + 1}`, 'N female'),
          endpoint(a, 'RF-IN', 'N female'),
          '50 Ω 1/2-inch coax feeder',
          'Indoor antenna branch',
          'Splitter output → coax feeder → ceiling antenna. Demonstration connector schedule; actual insertion loss and power ratings require product data.',
        ),
      );
    } else
      served.forEach((a) =>
        add(
          `RF-${a.id}`,
          `${r.name} to ${a.name}`,
          'rf',
          endpoint(r, 'RF-A', '4.3-10 female'),
          endpoint(a, 'RF-A', '4.3-10 female'),
          '50 Ω superflex RF jumper',
          'Antenna RF branch',
          '4.3-10 male-to-male jumper; connect RRU RF-A to antenna RF-A. Weatherproof outdoor joints and retain a service loop.',
        ),
      );
  });
  const battery = p.equipment.find((e) => e.kind === 'battery');
  if (battery)
    add(
      'DC-SOURCE',
      'Battery to distribution',
      'dc',
      endpoint(battery, 'DC-OUT', 'DC terminal'),
      endpoint(pdu, 'DC-IN', 'DC terminal'),
      '2-core DC supply cable',
      'Nominal −48 V DC',
      'Demonstration supply path. Conductor sizing, protection and polarity must be verified against the real power design.',
    );
  for (const e of [gateway, ...radios]) {
    add(
      `DC-${e.id}`,
      `DC feed to ${e.name}`,
      'dc',
      endpoint(pdu, `FUSE-${e.id}`, 'Protected terminal'),
      endpoint(e, 'DC-IN', 'DC terminal'),
      '2-core DC feeder',
      'Protected equipment DC supply',
      'Dedicated distribution branch; fuse identifier matches the equipment ID. Power availability remains modeled at equipment level.',
    );
    add(
      `GND-${e.id}`,
      `${e.name} grounding`,
      'ground',
      endpoint(e, 'PE/GND', 'Ground stud'),
      endpoint(earth, `LUG-${e.id}`, 'Ground lug'),
      'Green/yellow bonding conductor',
      'Protective bonding',
      'Equipment chassis → labeled earth-bar lug. This drawing is a connectivity demonstration, not an electrical installation specification.',
    );
  }
  return { devices, cables };
}
export function externalCable(
  l: Backhaul,
  portfolio: Record<string, Project>,
): PhysicalCable {
  const a = portfolio[l.a],
    b = portfolio[l.b];
  const pa = buildSiteCabling(a),
    pb = buildSiteCabling(b);
  const da =
      pa.devices.find(
        (e) => e.id === (l.kind === 'microwave' ? `W-MW-${l.id}` : 'W-ODF'),
      ) ||
      ancillary(
        a,
        'UNTERMINATED',
        'Missing site termination',
        'cabinet',
        [0, 0, 0],
        [0.1, 0.1, 0.1],
      ),
    db =
      pb.devices.find(
        (e) => e.id === (l.kind === 'microwave' ? `W-MW-${l.id}` : 'W-ODF'),
      ) ||
      ancillary(
        b,
        'UNTERMINATED',
        'Missing site termination',
        'cabinet',
        [0, 0, 0],
        [0.1, 0.1, 0.1],
      );
  const sa = siteById(l.a)!,
    sb = siteById(l.b)!;
  const microwave = l.kind === 'microwave';
  return {
    id: l.id,
    label: `${l.a} ↔ ${l.b}`,
    medium: microwave ? 'microwave' : 'fiber',
    role: 'intersite transport',
    from: equipmentEndpoint(
      a,
      da,
      microwave ? 'RF path' : `Tray-${l.id}:1/2`,
      microwave ? 'Air interface' : 'Fusion splice',
    ),
    to: equipmentEndpoint(
      b,
      db,
      microwave ? 'RF path' : `Tray-${l.id}:1/2`,
      microwave ? 'Air interface' : 'Fusion splice',
    ),
    cable: microwave
      ? 'Point-to-point microwave path'
      : '12-core OS2 trunk; strands 1/2 active',
    length: rounded(Math.hypot(sa.x - sb.x, sa.y - sb.y) * 2.5),
    lengthBasis: 'Illustrative campus coordinates × 2.5 m; not surveyed',
    service: `${l.capacity} Mbps ${l.kind === 'ethernet' ? 'Ethernet service over fiber' : l.kind} · VLAN ${l.vlan}`,
    details: microwave
      ? 'No physical cable between sites. Each terminal is connected locally by shielded Ethernet. Line of sight and radio engineering are not simulated.'
      : 'Site A splice tray → OS2 trunk strands 1/2 → Site B splice tray. Strand 1 carries A Tx → B Rx, strand 2 carries B Tx → A Rx; 3–12 are spare.',
    networkLink: l.id,
  };
}
export type CircuitTrace = {
  source: string;
  target: string;
  steps: PhysicalCable[];
  warning: string | null;
};
export function traceCircuit(
  portfolio: Record<string, Project>,
  siteId: string,
  assetId: string,
  route: number[] | undefined,
  source: string | undefined,
): CircuitTrace {
  const p = portfolio[siteId],
    plan = buildSiteCabling(p);
  if (!route || !source)
    return {
      source: source || 'No core',
      target: `${siteId}/${assetId}`,
      steps: [],
      warning: 'No transport path reaches this site.',
    };
  const steps: PhysicalCable[] = [];
  const core = buildSiteCabling(portfolio[source]);
  steps.push(
    ...core.cables.filter(
      (c) => c.id.endsWith('/CORE-LAN') || c.id.endsWith('/CORE-GW'),
    ),
  );
  let current = source;
  const orient = (c: PhysicalCable, reverse: boolean) =>
    reverse ? { ...c, from: c.to, to: c.from } : c;
  for (const i of route) {
    const l = networkLinks[i],
      next = l.a === current ? l.b : l.a;
    const from = buildSiteCabling(portfolio[current]),
      to = buildSiteCabling(portfolio[next]);
    steps.push(...from.cables.filter((c) => c.networkLink === l.id));
    steps.push(orient(externalCable(l, portfolio), l.a !== current));
    steps.push(
      ...to.cables
        .filter((c) => c.networkLink === l.id)
        .reverse()
        .map((c) => orient(c, true)),
    );
    current = next;
  }
  const antenna = p.equipment.find((e) => e.id === assetId);
  const rf = plan.cables.find(
    (c) => c.medium === 'rf' && c.to.assetId === assetId,
  );
  if (rf) {
    const splitter = rf.from.assetId.startsWith('W-SPLIT-')
      ? plan.cables.find(
          (c) => c.medium === 'rf' && c.to.assetId === rf.from.assetId,
        )
      : undefined;
    const radioId = splitter ? splitter.from.assetId : rf.from.assetId;
    const fronthaul = plan.cables.find(
      (c) => c.medium === 'fiber' && c.to.assetId === radioId,
    );
    if (fronthaul) steps.push(fronthaul);
    if (splitter) steps.push(splitter);
    steps.push(rf);
  } else if (antenna?.kind === 'radio') {
    const fronthaul = plan.cables.find(
      (c) => c.medium === 'fiber' && c.to.assetId === assetId,
    );
    if (fronthaul) steps.push(fronthaul);
  }
  return {
    source,
    target: `${siteId}/${assetId}`,
    steps,
    warning: steps.some((c) =>
      [c.from, c.to].some(
        (end) =>
          portfolio[end.siteId]?.equipment.find((e) => e.id === end.assetId)
            ?.condition === 'offline',
      ),
    )
      ? 'Physical path contains offline equipment.'
      : antenna?.kind === 'antenna' && !rf
        ? 'No modeled radio-to-antenna jumper reaches this asset.'
        : null,
  };
}

import * as THREE from 'three';
import { siteDefinitions, siteById, networkLinks } from './private-network.ts';
import type { Project } from './site-model.ts';
import {
  createStructure,
  createEquipmentMesh,
  createWiringFixtureMesh,
} from './site-geometry.ts';
import { buildSiteCabling, externalCable } from './cabling.ts';
import { createCableMesh } from './cable-geometry.ts';
export const siteWorldPosition = (id: string) => {
  const s = siteById(id)!;
  return new THREE.Vector3((s.x - 500) * 2.5, 0, (s.y - 350) * 2.5);
};
export function createNetworkModel(
  portfolio: Record<string, Project>,
  elevation: (id: string) => number = () => 0,
) {
  const group = new THREE.Group(),
    lods = new Map<string, THREE.LOD>(),
    cables = new Map<string, THREE.Mesh>(),
    assets = new Map<string, THREE.Mesh>(),
    links = new Map<string, THREE.Line>();
  for (const s of siteDefinitions) {
    const p = portfolio[s.id],
      plan = buildSiteCabling(p),
      lod = new THREE.LOD(),
      detail = new THREE.Group();
    lod.name = s.id;
    lod.position.copy(siteWorldPosition(s.id));
    lod.position.y = elevation(s.id);
    const structure = createStructure(s.type);
    structure.traverse((o) => {
      o.userData.siteId = s.id;
    });
    detail.add(structure);
    for (const e of p.equipment) {
      const mesh = createEquipmentMesh(e);
      mesh.userData.siteId = s.id;
      detail.add(mesh);
      assets.set(`${s.id}/${e.id}`, mesh);
    }
    for (const e of plan.devices) {
      const mesh = createWiringFixtureMesh(e, s.id, elevation);
      mesh.traverse((o) => {
        o.userData = {
          siteId: s.id,
          fixtureId: e.id,
          cableId: plan.cables.find(
            (c) => c.from.assetId === e.id || c.to.assetId === e.id,
          )?.id,
        };
      });
      detail.add(mesh);
    }
    for (const c of plan.cables) {
      const mesh = createCableMesh(c);
      mesh.userData.siteId = s.id;
      mesh.userData.medium = c.medium;
      detail.add(mesh);
      cables.set(c.id, mesh);
    }
    const overview = new THREE.Mesh(
      new THREE.BoxGeometry(
        s.type === 'GBT' || s.type === 'SMALL_CELL' ? 3 : 13,
        s.height,
        s.type === 'GBT' || s.type === 'SMALL_CELL' ? 3 : 10,
      ),
      new THREE.MeshStandardMaterial({
        color: s.type === 'CORE' ? '#6ea7dc' : '#72aaa4',
        transparent: true,
        opacity: 0.65,
      }),
    );
    overview.position.y = s.height / 2;
    overview.userData.siteId = s.id;
    lod.addLevel(detail, 0);
    lod.addLevel(overview, 220);
    group.add(lod);
    lods.set(s.id, lod);
  }
  for (const l of networkLinks) {
    const c = externalCable(l, portfolio),
      a = new THREE.Vector3(...c.from.position).add(siteWorldPosition(l.a)),
      b = new THREE.Vector3(...c.to.position).add(siteWorldPosition(l.b));
    a.y += elevation(l.a);
    b.y += elevation(l.b);
    const points =
      l.kind === 'microwave'
        ? [a, b]
        : [
            a,
            new THREE.Vector3(a.x, elevation(l.a) + 0.3, a.z + 1),
            new THREE.Vector3(b.x, elevation(l.b) + 0.3, b.z + 1),
            b,
          ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points),
      material =
        l.kind === 'microwave'
          ? new THREE.LineDashedMaterial({
              color: '#ae91dd',
              dashSize: 8,
              gapSize: 5,
            })
          : new THREE.LineBasicMaterial({
              color: l.kind === 'ethernet' ? '#6ca9e3' : '#49bfac',
            });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.userData.linkId = l.id;
    links.set(l.id, line);
    group.add(line);
  }
  group.updateMatrixWorld(true);
  return { group, lods, cables, assets, links };
}

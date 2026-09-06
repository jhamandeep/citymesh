import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPortfolio} from './lib/site-model.ts';
import {createNetworkModel,siteWorldPosition} from './lib/network-geometry.ts';
import {networkLinks} from './lib/private-network.ts';
import {buildSiteCabling,externalCable} from './lib/cabling.ts';
import {disposeObject} from './lib/site-geometry.ts';
const portfolio=createPortfolio(),model=createNetworkModel(portfolio);assert.equal(model.lods.size,30);assert.equal(model.assets.size,254);assert.equal(model.cables.size,624);assert.equal(model.links.size,38);const camera=new THREE.PerspectiveCamera();
for(const p of Object.values(portfolio)){const offset=siteWorldPosition(p.siteId),lod=model.lods.get(p.siteId);camera.position.copy(offset).add(new THREE.Vector3(0,15,50));camera.updateMatrixWorld();lod.update(camera);assert.equal(lod.levels[0].object.visible,true);assert.equal(lod.levels[1].object.visible,false);camera.position.copy(offset).add(new THREE.Vector3(0,1000,1000));camera.updateMatrixWorld();lod.update(camera);assert.equal(lod.levels[0].object.visible,false);assert.equal(lod.levels[1].object.visible,true);
 for(const e of p.equipment){const mesh=model.assets.get(`${p.siteId}/${e.id}`);assert.equal(mesh.userData.assetId,e.id);assert.equal(mesh.userData.siteId,p.siteId);assert.ok(mesh.getWorldPosition(new THREE.Vector3()).distanceTo(offset.clone().add(new THREE.Vector3(...e.position)))<1e-8);assert.equal(mesh.rotation.y,-e.azimuth*Math.PI/180);}
 for(const c of buildSiteCabling(p).cables){const mesh=model.cables.get(c.id);assert.equal(mesh.userData.cableId,c.id);assert.equal(mesh.userData.medium,c.medium);assert.equal(mesh.userData.siteId,p.siteId);assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));}
}
for(const l of networkLinks){const cable=externalCable(l,portfolio),line=model.links.get(l.id),coords=line.geometry.attributes.position;const a=new THREE.Vector3().fromBufferAttribute(coords,0),b=new THREE.Vector3().fromBufferAttribute(coords,coords.count-1);assert.ok(a.distanceTo(new THREE.Vector3(...cable.from.position).add(siteWorldPosition(l.a)))<.0002,l.id);assert.ok(b.distanceTo(new THREE.Vector3(...cable.to.position).add(siteWorldPosition(l.b)))<.0002,l.id);if(l.kind==='microwave')assert.equal(coords.count,2,'Microwave path is straight between terminals');}
const target=model.assets.get('GBT-01/ANT-A');const center=target.getWorldPosition(new THREE.Vector3());const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,-5)),new THREE.Vector3(0,0,1));const hit=ray.intersectObject(target)[0];assert.equal(hit.object.userData.assetId,'ANT-A');assert.equal(hit.object.userData.siteId,'GBT-01');disposeObject(model.group);
console.log('Network geometry verified: 30 detailed sites, 254 positioned assets, 624 local cable meshes, 38 exact termination-to-termination paths, near/far detail switching and world-space asset picking. WebGL pixels and frame rate are not measured.');

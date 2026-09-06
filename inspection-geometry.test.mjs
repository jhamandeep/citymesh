import assert from 'node:assert/strict';
import * as THREE from 'three';
import {physicalBounds,inspectionView} from './lib/inspection-geometry.ts';
import {createEquipmentMesh,createWiringFixtureMesh,disposeObject} from './lib/site-geometry.ts';
import {createPortfolio} from './lib/site-model.ts';
import {buildSiteCabling} from './lib/cabling.ts';


let n=0;for(const p of Object.values(createPortfolio()))for(const e of [...p.equipment,...buildSiteCabling(p).devices]){const object=e.id.startsWith('W-')?createWiringFixtureMesh(e,p.siteId):createEquipmentMesh(e);const bounds=physicalBounds(object);assert(!bounds.isEmpty());for(const aspect of [.5,1,2]){const pose=inspectionView(bounds,40,aspect);const camera=new THREE.PerspectiveCamera(40,aspect,.1,300);camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const q=new THREE.Vector3(x,y,z).project(camera);assert(Math.abs(q.x)<1&&Math.abs(q.y)<1&&Math.abs(q.z)<1);}}disposeObject(object);n++;}assert.equal(inspectionView(new THREE.Box3(),40,1),null);console.log(`PASS: camera framing for ${n} equipment/fixtures at three aspect ratios.`);

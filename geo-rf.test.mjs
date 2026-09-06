import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPortfolio} from './lib/site-model.ts';
import {networkLinks,siteDefinitions} from './lib/private-network.ts';
import {buildSiteCabling} from './lib/cabling.ts';
import {createWiringFixtureMesh,disposeObject} from './lib/site-geometry.ts';
import {siteGeo,mercator,defaults,receivedPower,coverageRadius,eirp,parseRF,defaultRF} from './lib/geo-rf.ts';
let count=0;const portfolio=createPortfolio();
for(const s of siteDefinitions){const g=siteGeo(s.id);assert(g.lat>30.25&&g.lat<30.28&&g.lon>-97.76&&g.lon<-97.73);const plan=buildSiteCabling(portfolio[s.id]);for(const e of plan.devices.filter(e=>e.id.startsWith('W-MW-'))){const mesh=createWiringFixtureMesh(e,s.id);assert(mesh.getObjectByName('Parabolic reflector · 1.2 m diameter'));assert(mesh.getObjectByName('Outdoor radio / ODU'));const cable=plan.cables.find(c=>c.to.assetId===e.id);assert.equal(cable.to.port,'GE/PoE');assert.equal(cable.medium,'ethernet');mesh.updateMatrixWorld(true);const port=mesh.getObjectByName('Weatherproof GE / PoE termination').getWorldPosition(new THREE.Vector3());assert(port.distanceTo(new THREE.Vector3(...cable.to.position))<1e-8);disposeObject(mesh);count++;}}
assert.equal(count,networkLinks.filter(l=>l.kind==='microwave').length*2);assert.equal(buildSiteCabling(portfolio['GBT-01']).devices.filter(e=>e.id.startsWith('W-MW')).length,0);
const c=defaults('GBT-01');assert.equal(eirp(c),43);const r=coverageRadius(c);assert(Math.abs(receivedPower(c,r)-c.threshold)<1e-8);assert(coverageRadius({...c,power:c.power+3})>r);assert(coverageRadius({...c,frequency:c.frequency*2})<r);assert(receivedPower(c,100,180)<receivedPower(c,100,0));assert.deepEqual(parseRF(JSON.stringify(defaultRF())),defaultRF());assert.throws(()=>parseRF(JSON.stringify({'GBT-01':{...c,power:999}})));assert(mercator(30.27,-97.74,15).y<mercator(30.26,-97.74,15).y);
console.log(`PASS: ${count} microwave dishes with Ethernet termination; 30 Austin coordinates; RF link budget, radius, validation and projection.`);

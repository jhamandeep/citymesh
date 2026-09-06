import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPortfolio} from './lib/site-model.ts';
import {networkLinks,simulateNetwork} from './lib/private-network.ts';
import {buildSiteCabling,externalCable,traceCircuit,equipmentEndpoint} from './lib/cabling.ts';
import {createCableMesh} from './lib/cable-geometry.ts';
const portfolio=createPortfolio(),network=simulateNetwork('normal',100);let count=0,antennas=0;
for(const p of Object.values(portfolio)){
 const plan=buildSiteCabling(p),ids=new Set([...p.equipment,...plan.devices].map(e=>e.id));assert.equal(new Set(plan.cables.map(c=>c.id)).size,plan.cables.length);
 for(const c of plan.cables){count++;assert.ok(ids.has(c.from.assetId)&&ids.has(c.to.assetId),c.id);assert.ok(c.from.port&&c.to.port);assert.ok(Number.isFinite(c.length)&&c.length>0);const mesh=createCableMesh(c,true);mesh.geometry.computeBoundingBox();assert.ok(!mesh.geometry.boundingBox.isEmpty());assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));assert.equal(mesh.userData.cableId,c.id);assert.equal(mesh.children.length,2);mesh.geometry.dispose();mesh.material.dispose();for(const child of mesh.children){child.geometry.dispose();child.material.dispose();}}
 const state=network.states.find(s=>s.id===p.siteId);
 for(const a of p.equipment.filter(e=>e.kind==='antenna')){antennas++;const trace=traceCircuit(portfolio,p.siteId,a.id,state.route,state.source);assert.equal(trace.warning,null,`${p.siteId}/${a.id}`);assert.equal(trace.steps.at(-1).to.assetId,a.id);assert.ok(trace.steps.some(c=>c.id.endsWith('/CORE-LAN')));for(let i=1;i<trace.steps.length;i++){const previous=trace.steps[i-1].to,current=trace.steps[i].from;assert.equal(`${previous.siteId}/${previous.assetId}`,`${current.siteId}/${current.assetId}`,`Discontinuous trace at ${trace.steps[i].id}`);}}
}
for(const l of networkLinks){const c=externalCable(l,portfolio);assert.equal(c.from.siteId,l.a);assert.equal(c.to.siteId,l.b);assert.ok(c.from.assetId!=='UNTERMINATED');assert.equal(c.medium,l.kind==='microwave'?'microwave':'fiber');}
const edited=structuredClone(portfolio);edited['GBT-01'].equipment=edited['GBT-01'].equipment.filter(e=>e.id!=='RRU-A');assert.ok(!buildSiteCabling(edited['GBT-01']).cables.some(c=>c.to.assetId==='ANT-A'));assert.equal(buildSiteCabling(edited['GBT-01']).cables.find(c=>c.to.assetId==='ANT-B').from.assetId,'RRU-B');
edited['IBS-01'].equipment=edited['IBS-01'].equipment.filter(e=>e.id!=='RU-F1');assert.ok(!buildSiteCabling(edited['IBS-01']).cables.some(c=>c.to.assetId==='DAS-F1-1'));assert.ok(buildSiteCabling(edited['IBS-01']).cables.some(c=>c.to.assetId==='DAS-F2-1'));
edited['GBT-01'].equipment=[];assert.equal(externalCable(networkLinks.find(l=>l.a==='GBT-01'||l.b==='GBT-01'),edited)[networkLinks.find(l=>l.a==='GBT-01'||l.b==='GBT-01').a==='GBT-01'?'from':'to'].assetId,'UNTERMINATED');
const a={...portfolio['GBT-01'].equipment[0],position:[0,0,0],azimuth:90};assert.ok(equipmentEndpoint(portfolio['GBT-01'],a,'RF','test').position[0]>0);
const failed=simulateNetwork('core',100);for(const s of failed.states.filter(s=>s.route&&s.type!=='CORE')){const asset=portfolio[s.id].equipment.find(e=>e.kind==='antenna');assert.equal(traceCircuit(portfolio,s.id,asset.id,s.route,s.source).source,'CORE-02');}
console.log(`Cabling verified: ${count} local segments, ${antennas} complete antenna traces, 38 intersite paths, finite Three.js geometry, stable wiring after deletions and backup-core traces.`);
